
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createNotification } = require("../utils/notify");
const { logAction } = require("../utils/auditLog");


const RESERVATION_HOLD_HOURS = 72;


async function expireStaleReservations() {
  const [stale] = await pool.query(
    `SELECT reservation_id, listing_id, quantity
     FROM reservations
     WHERE status IN ('pending', 'approved') AND expires_at < NOW()`
  );

  for (const r of stale) {
    await pool.query(
      `UPDATE produce_listings SET available_quantity = available_quantity + ? WHERE listing_id = ?`,
      [r.quantity, r.listing_id]
    );
    await pool.query(`UPDATE reservations SET status = 'expired' WHERE reservation_id = ?`, [r.reservation_id]);
  }
}


router.post("/", verifyToken, requireRole("buyer"), async (req, res) => {
  const { listing_id, quantity } = req.body;
  const qty = Number(quantity);

  if (!listing_id || !qty || qty <= 0) {
    return res.status(400).json({ error: "listing_id and a positive quantity are required." });
  }

  const conn = await pool.getConnection();
  try {
    await expireStaleReservations();
    await conn.beginTransaction();

    const [[listing]] = await conn.query(
      "SELECT * FROM produce_listings WHERE listing_id = ? FOR UPDATE",
      [listing_id]
    );
    if (!listing) {
      await conn.rollback();
      return res.status(404).json({ error: "Listing not found." });
    }
    if (listing.status !== "available") {
      await conn.rollback();
      return res.status(409).json({ error: "This listing is not currently available." });
    }
    if (Number(listing.available_quantity) < qty) {
      await conn.rollback();
      return res.status(409).json({
        error: `Only ${listing.available_quantity} ${listing.unit} available.`,
      });
    }

    await conn.query(
      "UPDATE produce_listings SET available_quantity = available_quantity - ? WHERE listing_id = ?",
      [qty, listing_id]
    );

    const expiresAt = new Date(Date.now() + RESERVATION_HOLD_HOURS * 60 * 60 * 1000);
    const [result] = await conn.query(
      `INSERT INTO reservations (listing_id, buyer_id, quantity, expires_at)
       VALUES (?, ?, ?, ?)`,
      [listing_id, req.user.user_id, qty, expiresAt]
    );

    await conn.commit();

    await createNotification(
      listing.farmer_id,
      "new_reservation",
      `A buyer requested to reserve ${qty} ${listing.unit} of ${listing.crop_name}.`
    );
    await logAction(req.user.user_id, "create_reservation", `Reserved ${qty} ${listing.unit} of listing #${listing_id}.`);

    res.status(201).json({ message: "Reservation requested.", reservation_id: result.insertId, expires_at: expiresAt });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not create reservation." });
  } finally {
    conn.release();
  }
});


router.get("/mine", verifyToken, requireRole("buyer"), async (req, res) => {
  try {
    await expireStaleReservations();
    const [rows] = await pool.query(
      `SELECT r.*, pl.crop_name, pl.unit, pl.price_per_unit, pl.district, u.full_name AS farmer_name
       FROM reservations r
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       JOIN users u ON pl.farmer_id = u.user_id
       WHERE r.buyer_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ reservations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your reservations." });
  }
});


router.get("/incoming", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    await expireStaleReservations();
    const [rows] = await pool.query(
      `SELECT r.*, pl.crop_name, pl.unit, pl.price_per_unit, u.full_name AS buyer_name, u.phone AS buyer_phone
       FROM reservations r
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       JOIN users u ON r.buyer_id = u.user_id
       WHERE pl.farmer_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ reservations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch incoming reservations." });
  }
});


router.put("/:id/approve", verifyToken, requireRole("farmer"), async (req, res) => {
  const { id } = req.params;
  try {
    await expireStaleReservations();

    const [result] = await pool.query(
      `UPDATE reservations r
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       SET r.status = 'approved'
       WHERE r.reservation_id = ? AND pl.farmer_id = ? AND r.status = 'pending'`,
      [id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: "Reservation not found, not yours, or no longer pending." });
    }

    const [[r]] = await pool.query("SELECT buyer_id FROM reservations WHERE reservation_id = ?", [id]);
    if (r) {
      await createNotification(r.buyer_id, "reservation_approved", `Your reservation #${id} was approved. You can now pay.`);
    }
    await logAction(req.user.user_id, "approve_reservation", `Approved reservation #${id}.`);

    res.json({ message: "Reservation approved." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not approve reservation." });
  }
});

router.put("/:id/reject", verifyToken, requireRole("farmer"), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: "A rejection reason is required." });
  }

  const conn = await pool.getConnection();
  try {
    await expireStaleReservations();
    await conn.beginTransaction();

    const [[r]] = await conn.query(
      `SELECT r.*, pl.farmer_id
       FROM reservations r
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       WHERE r.reservation_id = ? FOR UPDATE`,
      [id]
    );
    if (!r || r.farmer_id !== req.user.user_id || r.status !== "pending") {
      await conn.rollback();
      return res.status(409).json({ error: "Reservation not found, not yours, or no longer pending." });
    }

    await conn.query(
      "UPDATE reservations SET status = 'rejected', rejection_reason = ? WHERE reservation_id = ?",
      [reason.trim(), id]
    );
    await conn.query(
      "UPDATE produce_listings SET available_quantity = available_quantity + ? WHERE listing_id = ?",
      [r.quantity, r.listing_id]
    );

    await conn.commit();

    await createNotification(r.buyer_id, "reservation_rejected", `Your reservation #${id} was rejected: ${reason.trim()}`);
    await logAction(req.user.user_id, "reject_reservation", `Rejected reservation #${id}: ${reason.trim()}`);

    res.json({ message: "Reservation rejected." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not reject reservation." });
  } finally {
    conn.release();
  }
});


router.put("/:id/cancel", verifyToken, requireRole("buyer"), async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await expireStaleReservations();
    await conn.beginTransaction();

    const [[r]] = await conn.query(
      "SELECT * FROM reservations WHERE reservation_id = ? AND buyer_id = ? FOR UPDATE",
      [id, req.user.user_id]
    );
    if (!r || !["pending", "approved"].includes(r.status)) {
      await conn.rollback();
      return res.status(409).json({ error: "Reservation not found or cannot be cancelled." });
    }

    await conn.query("UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?", [id]);
    await conn.query(
      "UPDATE produce_listings SET available_quantity = available_quantity + ? WHERE listing_id = ?",
      [r.quantity, r.listing_id]
    );

    await conn.commit();
    await logAction(req.user.user_id, "cancel_reservation", `Cancelled reservation #${id}.`);
    res.json({ message: "Reservation cancelled." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not cancel reservation." });
  } finally {
    conn.release();
  }
});

module.exports = router;
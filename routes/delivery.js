const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createNotification } = require("../utils/notify");
const { logAction } = require("../utils/auditLog");

router.post("/request", verifyToken, requireRole("farmer", "buyer"), async (req, res) => {
  const { listing_id, reservation_id, pickup_district, dropoff_district, pickup_date, notes } = req.body;

  if (!listing_id) {
    return res.status(400).json({ error: "listing_id is required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO delivery_requests
        (listing_id, reservation_id, requested_by, pickup_district, dropoff_district, pickup_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [listing_id, reservation_id || null, req.user.user_id, pickup_district, dropoff_district, pickup_date || null, notes || ""]
    );
    res.status(201).json({ message: "Delivery request created.", request_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create delivery request." });
  }
});


router.get("/open", verifyToken, requireRole("transporter"), async (req, res) => {
  const { district } = req.query;
  try {
    let sql = `
      SELECT dr.request_id, dr.pickup_district, dr.dropoff_district, dr.pickup_date, dr.notes,
             dr.status, dr.created_at,
             pl.crop_name, pl.quantity, pl.unit,
             u.full_name AS requested_by_name
      FROM delivery_requests dr
      JOIN produce_listings pl ON dr.listing_id = pl.listing_id
      JOIN users u ON dr.requested_by = u.user_id
      WHERE dr.status = 'pending'
    `;
    const params = [];
    if (district) {
      sql += " AND dr.pickup_district = ?";
      params.push(district);
    }
    sql += " ORDER BY dr.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch open delivery requests." });
  }
});


router.put("/:id/accept", verifyToken, requireRole("transporter"), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      `UPDATE delivery_requests
       SET transporter_id = ?, status = 'accepted', accepted_at = NOW()
       WHERE request_id = ? AND status = 'pending'`,
      [req.user.user_id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: "This request is no longer available." });
    }

    const [[req_row]] = await pool.query(
      "SELECT requested_by FROM delivery_requests WHERE request_id = ?",
      [id]
    );
    if (req_row) {
      await createNotification(
        req_row.requested_by,
        "delivery_accepted",
        `Your delivery request has been accepted by a transporter.`
      );
    }
    await logAction(req.user.user_id, "accept_delivery", `Accepted delivery request #${id}.`);

    res.json({ message: "Delivery request accepted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not accept delivery request." });
  }
});

router.put("/:id/status", verifyToken, requireRole("transporter"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 
  const allowed = ["in_transit", "delivered", "cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  const timestampColumn =
    status === "in_transit" ? "in_transit_at" : status === "delivered" ? "delivered_at" : null;

  try {
    const sql = timestampColumn
      ? `UPDATE delivery_requests SET status = ?, ${timestampColumn} = NOW() WHERE request_id = ? AND transporter_id = ?`
      : `UPDATE delivery_requests SET status = ? WHERE request_id = ? AND transporter_id = ?`;

    const [result] = await pool.query(sql, [status, id, req.user.user_id]);
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: "You are not assigned to this delivery." });
    }

    const [[req_row]] = await pool.query(
      "SELECT requested_by FROM delivery_requests WHERE request_id = ?",
      [id]
    );
    if (req_row) {
      await createNotification(
        req_row.requested_by,
        "delivery_status",
        `Your delivery status changed to: ${status}.`
      );
    }
    await logAction(req.user.user_id, "update_delivery_status", `Delivery #${id} marked as ${status}.`);

    res.json({ message: `Delivery marked as ${status}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update delivery status." });
  }
});

router.get("/mine", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dr.*, pl.crop_name, pl.quantity, pl.unit,
              t.full_name AS transporter_name
       FROM delivery_requests dr
       JOIN produce_listings pl ON dr.listing_id = pl.listing_id
       LEFT JOIN users t ON dr.transporter_id = t.user_id
       WHERE dr.requested_by = ? OR dr.transporter_id = ?
       ORDER BY dr.created_at DESC`,
      [req.user.user_id, req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your deliveries." });
  }
});

router.get("/for-buyer", verifyToken, requireRole("buyer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dr.*, pl.crop_name, pl.unit, r.quantity AS reservation_quantity,
              t.full_name AS transporter_name
       FROM delivery_requests dr
       JOIN produce_listings pl ON dr.listing_id = pl.listing_id
       JOIN reservations r ON r.listing_id = dr.listing_id
       LEFT JOIN users t ON dr.transporter_id = t.user_id
       WHERE r.buyer_id = ?
       ORDER BY dr.created_at DESC`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your order deliveries." });
  }
});;

module.exports = router;
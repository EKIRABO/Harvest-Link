
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");

router.post("/", verifyToken, requireRole("farmer"), async (req, res) => {
  const { listing_id, quantity, amount, buyer_name, notes } = req.body;
  const qty = Number(quantity);

  if (!listing_id || !qty || qty <= 0 || !amount) {
    return res.status(400).json({ error: "listing_id, a positive quantity, and amount are required." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[listing]] = await conn.query(
      "SELECT * FROM produce_listings WHERE listing_id = ? AND farmer_id = ? FOR UPDATE",
      [listing_id, req.user.user_id]
    );
    if (!listing) {
      await conn.rollback();
      return res.status(404).json({ error: "Listing not found or not yours." });
    }
    if (Number(listing.available_quantity) < qty) {
      await conn.rollback();
      return res.status(409).json({ error: `Only ${listing.available_quantity} ${listing.unit} available.` });
    }

    await conn.query(
      "UPDATE produce_listings SET available_quantity = available_quantity - ? WHERE listing_id = ?",
      [qty, listing_id]
    );

    const [result] = await conn.query(
      `INSERT INTO offline_sales (farmer_id, listing_id, quantity, amount, buyer_name, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, listing_id, qty, amount, buyer_name || null, notes || null]
    );

    if (Number(listing.available_quantity) - qty <= 0) {
      await conn.query("UPDATE produce_listings SET status = 'sold' WHERE listing_id = ?", [listing_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, "record_offline_sale", `Sold ${qty} ${listing.unit} of listing #${listing_id} offline for ${amount}.`);

    res.status(201).json({ message: "Offline sale recorded.", sale_id: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not record sale." });
  } finally {
    conn.release();
  }
});

router.get("/mine", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT os.*, pl.crop_name, pl.unit
       FROM offline_sales os
       JOIN produce_listings pl ON os.listing_id = pl.listing_id
       WHERE os.farmer_id = ?
       ORDER BY os.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ sales: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch offline sales." });
  }
});

module.exports = router;
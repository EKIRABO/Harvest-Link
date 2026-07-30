
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createNotification } = require("../utils/notify");
const { logAction } = require("../utils/auditLog");


router.get("/mine", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sb.*, sp.facility_name, sp.district AS facility_district, u.full_name AS provider_name
       FROM storage_bookings sb
       JOIN storage_profiles sp ON sb.storage_user_id = sp.user_id
       JOIN users u ON sb.storage_user_id = u.user_id
       WHERE sb.farmer_id = ?
       ORDER BY sb.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your storage bookings." });
  }
});

router.get("/", verifyToken, requireRole("storage_provider"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sb.*, u.full_name AS farmer_name, u.phone AS farmer_phone
       FROM storage_bookings sb
       JOIN users u ON sb.farmer_id = u.user_id
       WHERE sb.storage_user_id = ?
       ORDER BY sb.created_at DESC`,
      [req.user.user_id]
    );
    res.json({ bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch bookings." });
  }
});


router.post("/", verifyToken, requireRole("farmer"), async (req, res) => {
  const { storage_user_id, quantity_tons, notes } = req.body;

  if (!storage_user_id || !quantity_tons) {
    return res.status(400).json({ error: "storage_user_id and quantity_tons are required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO storage_bookings (farmer_id, storage_user_id, quantity_tons, notes)
       VALUES (?, ?, ?, ?)`,
      [req.user.user_id, storage_user_id, quantity_tons, notes || null]
    );

    await createNotification(
      storage_user_id,
      "storage_booking_requested",
      `A farmer requested to reserve ${quantity_tons} tons of storage space.`
    );
    await logAction(req.user.user_id, "request_storage_booking", `Requested ${quantity_tons} tons at facility user #${storage_user_id}.`);

    res.status(201).json({ message: "Storage booking requested.", booking_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create storage booking." });
  }
});


router.put("/:id/status", verifyToken, requireRole("storage_provider"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 

  if (!["confirmed", "cancelled", "collected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE storage_bookings SET status = ? WHERE booking_id = ? AND storage_user_id = ?`,
      [status, id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: "Booking not found or not yours to manage." });
    }

    const [[booking]] = await pool.query(`SELECT farmer_id FROM storage_bookings WHERE booking_id = ?`, [id]);
    if (booking) {
      await createNotification(
        booking.farmer_id,
        "storage_booking_status",
        `Your storage booking was ${status}.`
      );
    }
    await logAction(req.user.user_id, "update_storage_booking", `Booking #${id} marked as ${status}.`);

    res.json({ message: `Booking marked as ${status}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update booking." });
  }
});

module.exports = router;
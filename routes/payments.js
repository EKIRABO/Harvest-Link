
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createNotification } = require("../utils/notify");
const { logAction } = require("../utils/auditLog");

const ALLOWED_METHODS = ["mtn", "airtel", "visa", "cash"];

function generateTransactionRef() {
  return `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}


router.post("/produce", verifyToken, requireRole("buyer"), async (req, res) => {
  const { reservation_id, method } = req.body;

  if (!reservation_id || !ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({ error: "reservation_id and a valid method (mtn, airtel, visa, cash) are required." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[reservation]] = await conn.query(
      `SELECT r.*, pl.price_per_unit, pl.farmer_id, pl.available_quantity, pl.listing_id AS pl_listing_id
       FROM reservations r
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       WHERE r.reservation_id = ? AND r.buyer_id = ? FOR UPDATE`,
      [reservation_id, req.user.user_id]
    );

    if (!reservation) {
      await conn.rollback();
      return res.status(404).json({ error: "Reservation not found." });
    }
    if (reservation.status !== "approved") {
      await conn.rollback();
      return res.status(409).json({ error: "Only approved reservations can be paid for." });
    }

    const amount = Number(reservation.price_per_unit || 0) * Number(reservation.quantity);
    const transaction_ref = generateTransactionRef();

    const [paymentResult] = await conn.query(
      `INSERT INTO payments (payer_id, payment_type, reservation_id, method, amount, status, transaction_ref)
       VALUES (?, 'produce', ?, ?, ?, 'completed', ?)`,
      [req.user.user_id, reservation_id, method, amount, transaction_ref]
    );

    await conn.query("UPDATE reservations SET status = 'paid' WHERE reservation_id = ?", [reservation_id]);

    if (Number(reservation.available_quantity) <= 0) {
      await conn.query("UPDATE produce_listings SET status = 'sold' WHERE listing_id = ?", [reservation.pl_listing_id]);
    }

    await conn.commit();

    await createNotification(
      reservation.farmer_id,
      "payment_received",
      `Payment received for reservation #${reservation_id} (${amount.toFixed(2)} RWF).`
    );
    await logAction(req.user.user_id, "pay_reservation", `Paid ${amount.toFixed(2)} for reservation #${reservation_id} via ${method}.`);

    res.status(201).json({
      message: "Payment completed.",
      payment_id: paymentResult.insertId,
      transaction_ref,
      amount,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not process payment." });
  } finally {
    conn.release();
  }
});


router.post("/storage", verifyToken, requireRole("farmer"), async (req, res) => {
  const { storage_booking_id, amount, method } = req.body;

  if (!storage_booking_id || !amount || !ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({ error: "storage_booking_id, amount, and a valid method are required." });
  }

  try {
    const [[booking]] = await pool.query(
      `SELECT * FROM storage_bookings WHERE booking_id = ? AND farmer_id = ?`,
      [storage_booking_id, req.user.user_id]
    );
    if (!booking) {
      return res.status(404).json({ error: "Storage booking not found." });
    }

    const transaction_ref = generateTransactionRef();
    const [result] = await pool.query(
      `INSERT INTO payments (payer_id, payment_type, storage_booking_id, method, amount, status, transaction_ref)
       VALUES (?, 'storage', ?, ?, ?, 'completed', ?)`,
      [req.user.user_id, storage_booking_id, method, amount, transaction_ref]
    );

    await createNotification(
      booking.storage_user_id,
      "payment_received",
      `Payment received for storage booking #${storage_booking_id} (${Number(amount).toFixed(2)} RWF).`
    );
    await logAction(req.user.user_id, "pay_storage_booking", `Paid ${Number(amount).toFixed(2)} for storage booking #${storage_booking_id} via ${method}.`);

    res.status(201).json({ message: "Payment completed.", payment_id: result.insertId, transaction_ref });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process payment." });
  }
});

router.get("/mine", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM payments WHERE payer_id = ? ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    res.json({ payments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch payment history." });
  }
});


router.get("/farmer-sales", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.payment_id, p.amount, p.created_at, p.transaction_ref,
              r.quantity, pl.crop_name, pl.unit, u.full_name AS buyer_name
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.reservation_id
       JOIN produce_listings pl ON r.listing_id = pl.listing_id
       JOIN users u ON r.buyer_id = u.user_id
       WHERE pl.farmer_id = ?
         AND p.payment_type = 'produce'
         AND p.status = 'completed'
         AND MONTH(p.created_at) = MONTH(CURRENT_DATE())
         AND YEAR(p.created_at) = YEAR(CURRENT_DATE())
       ORDER BY p.created_at DESC`,
      [req.user.user_id]
    );

    const total_amount = rows.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({ sales: rows, total_amount, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch sales." });
  }
});


router.get("/storage-earnings", verifyToken, requireRole("storage_provider"), async (req, res) => {
  try {
    const [thisMonthRows] = await pool.query(
      `SELECT p.payment_id, p.amount, p.created_at, p.transaction_ref,
              sb.quantity_tons, u.full_name AS farmer_name
       FROM payments p
       JOIN storage_bookings sb ON p.storage_booking_id = sb.booking_id
       JOIN users u ON sb.farmer_id = u.user_id
       WHERE sb.storage_user_id = ?
         AND p.payment_type = 'storage'
         AND p.status = 'completed'
         AND MONTH(p.created_at) = MONTH(CURRENT_DATE())
         AND YEAR(p.created_at) = YEAR(CURRENT_DATE())
       ORDER BY p.created_at DESC`,
      [req.user.user_id]
    );

    const [[lastMonthTotal]] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN storage_bookings sb ON p.storage_booking_id = sb.booking_id
       WHERE sb.storage_user_id = ?
         AND p.payment_type = 'storage'
         AND p.status = 'completed'
         AND MONTH(p.created_at) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH)
         AND YEAR(p.created_at) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)`,
      [req.user.user_id]
    );

    const [[allTimeTotal]] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN storage_bookings sb ON p.storage_booking_id = sb.booking_id
       WHERE sb.storage_user_id = ? AND p.payment_type = 'storage' AND p.status = 'completed'`,
      [req.user.user_id]
    );

    const total_this_month = thisMonthRows.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({
      earnings: thisMonthRows,
      total_this_month,
      total_last_month: Number(lastMonthTotal.total),
      total_all_time: Number(allTimeTotal.total),
      count: thisMonthRows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch earnings." });
  }
});
router.get("/transporter-earnings", verifyToken, requireRole("transporter"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.payment_id, p.amount, p.created_at, p.transaction_ref, dr.pickup_district, dr.dropoff_district
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.reservation_id
       JOIN delivery_requests dr ON dr.listing_id = r.listing_id
       WHERE dr.transporter_id = ? AND p.status = 'completed'
       ORDER BY p.created_at DESC`,
      [req.user.user_id]
    );

    const total_earnings = rows.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({ 
      earnings: rows, 
      total_earnings: total_earnings, 
      total_amount: total_earnings, 
      count: rows.length 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch transporter earnings." });
  }
});

module.exports = router;
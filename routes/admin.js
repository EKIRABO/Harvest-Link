
const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");

const router = express.Router();


router.get("/users", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { role, search, active } = req.query;
    let query = `SELECT user_id, full_name, email, phone, role, district, sector, is_active, created_at FROM users WHERE 1=1`;
    const params = [];

    if (role) { query += " AND role = ?"; params.push(role); }
    if (active !== undefined) { query += " AND is_active = ?"; params.push(active === "1" ? 1 : 0); }
    if (search) { query += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch users." });
  }
});

router.put("/users/:id/suspend", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT user_id, full_name, role FROM users WHERE user_id = ?", [id]);
    if (!existing[0]) return res.status(404).json({ error: "User not found." });
    if (existing[0].role === "admin") return res.status(400).json({ error: "Cannot suspend an admin account." });

    await pool.query("UPDATE users SET is_active = 0 WHERE user_id = ?", [id]);
    await logAction(req.user.user_id, "suspend_user", `Suspended user #${id} (${existing[0].full_name}).`);
    res.json({ message: "User suspended." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not suspend user." });
  }
});


router.put("/users/:id/reactivate", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT user_id, full_name FROM users WHERE user_id = ?", [id]);
    if (!existing[0]) return res.status(404).json({ error: "User not found." });

    await pool.query("UPDATE users SET is_active = 1 WHERE user_id = ?", [id]);
    await logAction(req.user.user_id, "reactivate_user", `Reactivated user #${id} (${existing[0].full_name}).`);
    res.json({ message: "User reactivated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reactivate user." });
  }
});

router.get("/stats", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [[userCounts]] = await pool.query(
      `SELECT
         COUNT(*) AS total_users,
         SUM(role = 'farmer') AS total_farmers,
         SUM(role = 'buyer') AS total_buyers,
         SUM(role = 'transporter') AS total_transporters,
         SUM(role = 'storage_provider') AS total_storage_providers,
         SUM(is_active = 0) AS suspended_count
       FROM users`
    );
    const [[listingCounts]] = await pool.query(
      `SELECT COUNT(*) AS active_listings FROM produce_listings WHERE status = 'available'`
    );
    const [[reservationCounts]] = await pool.query(
      `SELECT COUNT(*) AS total_reservations FROM reservations`
    );
    const [[paymentCounts]] = await pool.query(
      `SELECT COUNT(*) AS total_transactions, COALESCE(SUM(amount), 0) AS total_amount FROM payments WHERE status = 'completed'`
    );

    res.json({
      total_users: userCounts.total_users,
      total_farmers: userCounts.total_farmers,
      total_buyers: userCounts.total_buyers,
      total_transporters: userCounts.total_transporters,
      total_storage_providers: userCounts.total_storage_providers,
      suspended_count: userCounts.suspended_count,
      active_listings: listingCounts.active_listings,
      total_reservations: reservationCounts.total_reservations,
      total_transactions: paymentCounts.total_transactions,
      total_amount: paymentCounts.total_amount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch platform stats." });
  }
});

router.get("/activity", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT al.log_id, al.action, al.details, al.created_at, u.full_name
       FROM audit_logs al
       LEFT JOIN users u ON u.user_id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 20`
    );
    res.json({ activity: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch activity log." });
  }
});

module.exports = router;
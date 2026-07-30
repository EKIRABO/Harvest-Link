// routes/storage.js
const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");

const router = express.Router();


router.get("/me", verifyToken, requireRole("storage_provider"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM storage_profiles WHERE user_id = ?", [req.user.user_id]);
    res.json({ facility: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your facility." });
  }
});


router.put("/me", verifyToken, requireRole("storage_provider"), async (req, res) => {
  try {
    const { facility_name, capacity_tons, available_capacity_tons, facility_type, district, sector, status } = req.body;

    await pool.query(
      `INSERT INTO storage_profiles
        (user_id, facility_name, capacity_tons, available_capacity_tons, facility_type, district, sector, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        facility_name = VALUES(facility_name),
        capacity_tons = VALUES(capacity_tons),
        available_capacity_tons = VALUES(available_capacity_tons),
        facility_type = VALUES(facility_type),
        district = VALUES(district),
        sector = VALUES(sector),
        status = VALUES(status)`,
      [
        req.user.user_id,
        facility_name || null,
        capacity_tons || null,
        available_capacity_tons || null,
        facility_type || null,
        district || null,
        sector || null,
        status || "available",
      ]
    );

    await logAction(req.user.user_id, "update_storage", `Updated storage facility: ${facility_name || "unnamed"}.`);

    res.json({ message: "Storage facility updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update facility." });
  }
});


router.get("/", verifyToken, async (req, res) => {
  try {
    const { district } = req.query;
    let query = `
      SELECT sp.*, u.full_name AS provider_name, u.phone AS provider_phone
      FROM storage_profiles sp
      JOIN users u ON sp.user_id = u.user_id
      WHERE u.is_active = 1
    `;
    const params = [];
    if (district) {
      query += " AND sp.district = ?";
      params.push(district);
    }
    query += " ORDER BY sp.status = 'available' DESC, sp.facility_name";

    const [rows] = await pool.query(query, params);
    res.json({ facilities: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch storage facilities." });
  }
});

module.exports = router;
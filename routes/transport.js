
const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const { district } = req.query;
    let query = `
      SELECT tp.*, u.full_name AS transporter_name, u.phone AS transporter_phone
      FROM transporter_profiles tp
      JOIN users u ON tp.user_id = u.user_id
      WHERE u.is_active = 1
    `;
    const params = [];
    if (district) {
      query += " AND tp.district = ?";
      params.push(district);
    }
    query += " ORDER BY tp.status = 'available' DESC, u.full_name";

    const [rows] = await pool.query(query, params);
    res.json({ transporters: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch transporters." });
  }
});


router.get("/me", verifyToken, requireRole("transporter"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM transporter_profiles WHERE user_id = ?", [req.user.user_id]);
    res.json({ profile: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your profile." });
  }
});

router.put("/me", verifyToken, requireRole("transporter"), async (req, res) => {
  try {
    const { vehicle_type, vehicle_capacity_kg, license_plate, district, sector, status } = req.body;

    await pool.query(
      `INSERT INTO transporter_profiles
        (user_id, vehicle_type, vehicle_capacity_kg, license_plate, district, sector, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        vehicle_type = VALUES(vehicle_type),
        vehicle_capacity_kg = VALUES(vehicle_capacity_kg),
        license_plate = VALUES(license_plate),
        district = VALUES(district),
        sector = VALUES(sector),
        status = VALUES(status)`,
      [
        req.user.user_id,
        vehicle_type || null,
        vehicle_capacity_kg || null,
        license_plate || null,
        district || null,
        sector || null,
        status || "available",
      ]
    );

    res.json({ message: "Transport availability updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update your availability." });
  }
});

module.exports = router;

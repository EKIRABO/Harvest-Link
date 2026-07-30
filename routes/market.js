const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");


router.post("/demand", verifyToken, requireRole("buyer"), async (req, res) => {
  const { crop_name, quantity_needed, unit, target_price_per_unit, district, needed_by, notes } = req.body;

  if (!crop_name || !quantity_needed) {
    return res.status(400).json({ error: "crop_name and quantity_needed are required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO market_demand
        (buyer_id, crop_name, quantity_needed, unit, target_price_per_unit, district, needed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, crop_name, quantity_needed, unit || "kg", target_price_per_unit, district, needed_by || null, notes]
    );

    await logAction(req.user.user_id, "post_demand", `Posted demand for ${crop_name}.`);

    res.status(201).json({ message: "Market demand posted.", demand_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not post market demand." });
  }
});


router.get("/demand", verifyToken, async (req, res) => {
  const { crop_name, district } = req.query;
  try {
    let sql = `
      SELECT md.*, u.full_name AS buyer_name
      FROM market_demand md
      JOIN users u ON md.buyer_id = u.user_id
      WHERE md.status = 'open'
    `;
    const params = [];
    if (crop_name) {
      sql += " AND md.crop_name LIKE ?";
      params.push(`%${crop_name}%`);
    }
    if (district) {
      sql += " AND md.district = ?";
      params.push(district);
    }
    sql += " ORDER BY md.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch market demand." });
  }
});


router.put("/demand/:id", verifyToken, requireRole("buyer"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 

  if (!["fulfilled", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE market_demand SET status = ? WHERE demand_id = ? AND buyer_id = ?`,
      [status, id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: "Not your demand post." });
    }
    res.json({ message: `Demand marked as ${status}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update demand." });
  }
});

module.exports = router;
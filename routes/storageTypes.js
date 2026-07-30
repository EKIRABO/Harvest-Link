
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");


router.get("/mine", verifyToken, requireRole("storage_provider"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM storage_types WHERE storage_user_id = ? ORDER BY created_at ASC`,
      [req.user.user_id]
    );
    res.json({ types: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch storage types." });
  }
});


router.post("/", verifyToken, requireRole("storage_provider"), async (req, res) => {
  const { type_name, capacity_tons, used_tons } = req.body;
  if (!type_name || !capacity_tons) {
    return res.status(400).json({ error: "type_name and capacity_tons are required." });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO storage_types (storage_user_id, type_name, capacity_tons, used_tons)
       VALUES (?, ?, ?, ?)`,
      [req.user.user_id, type_name, capacity_tons, used_tons || 0]
    );
    await logAction(req.user.user_id, "create_storage_type", `Added storage type "${type_name}" (${capacity_tons}t).`);
    res.status(201).json({ message: "Storage type added.", storage_type_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add storage type." });
  }
});


router.put("/:id", verifyToken, requireRole("storage_provider"), async (req, res) => {
  const { id } = req.params;
  const { type_name, capacity_tons, used_tons } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE storage_types SET
        type_name = COALESCE(?, type_name),
        capacity_tons = COALESCE(?, capacity_tons),
        used_tons = COALESCE(?, used_tons)
       WHERE storage_type_id = ? AND storage_user_id = ?`,
      [type_name || null, capacity_tons || null, used_tons ?? null, id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Storage type not found or not yours." });
    }
    await logAction(req.user.user_id, "update_storage_type", `Updated storage type #${id}.`);
    res.json({ message: "Storage type updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update storage type." });
  }
});

router.delete("/:id", verifyToken, requireRole("storage_provider"), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM storage_types WHERE storage_type_id = ? AND storage_user_id = ?`,
      [id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Storage type not found or not yours." });
    }
    res.json({ message: "Storage type removed." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove storage type." });
  }
});


router.get("/:storageUserId", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM storage_types WHERE storage_user_id = ? ORDER BY created_at ASC`,
      [req.params.storageUserId]
    );
    res.json({ types: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch storage types." });
  }
});

module.exports = router;
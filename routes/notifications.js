
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");


router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.user_id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch notifications." });
  }
});


router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json({ message: "Marked as read." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notification." });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");


router.post("/", verifyToken, async (req, res) => {
  const { receiver_id, body, listing_id, demand_id } = req.body;

  if (!receiver_id || !body) {
    return res.status(400).json({ error: "receiver_id and body are required." });
  }
  if (Number(receiver_id) === req.user.user_id) {
    return res.status(400).json({ error: "You cannot message yourself." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, listing_id, demand_id, body)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.user_id, receiver_id, listing_id || null, demand_id || null, body]
    );
    res.status(201).json({ message: "Message sent.", message_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send message." });
  }
});


router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [rows] = await pool.query(
      `SELECT
         m.message_id, m.body, m.created_at, m.is_read, m.sender_id, m.receiver_id,
         u.user_id AS other_user_id, u.full_name AS other_user_name, u.role AS other_user_role
       FROM messages m
       JOIN users u ON u.user_id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
       INNER JOIN (
         SELECT
           IF(sender_id = ?, receiver_id, sender_id) AS other_user_id,
           MAX(message_id) AS latest_message_id
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         GROUP BY other_user_id
       ) latest ON latest.latest_message_id = m.message_id
       ORDER BY m.created_at DESC`,
      [userId, userId, userId, userId]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch conversations." });
  }
});


router.get("/:userId", verifyToken, async (req, res) => {
  const otherUserId = req.params.userId;
  const userId = req.user.user_id;

  try {
    const [rows] = await pool.query(
      `SELECT m.*, u.full_name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
      [userId, otherUserId, otherUserId, userId]
    );

    await pool.query(
      `UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [otherUserId, userId]
    );

    res.json({ thread: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch conversation." });
  }
});

module.exports = router;
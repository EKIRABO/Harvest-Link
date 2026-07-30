
const pool = require("../config/db");

async function createNotification(userId, type, content) {
  try {
    await pool.query(
      "INSERT INTO notifications (user_id, type, content) VALUES (?, ?, ?)",
      [userId, type, content]
    );
  } catch (err) {
    console.error("Notification creation failed:", err.message);
  }
}

module.exports = { createNotification };
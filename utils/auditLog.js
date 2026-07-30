
const pool = require("../config/db");

async function logAction(userId, action, details = "") {
  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)",
      [userId, action, details]
    );
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = { logAction };
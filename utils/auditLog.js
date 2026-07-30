
const pool = require("../config/db");

async function logAction(userId, action, details = "") {
  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)",
      [userId, action, details]
    );
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    res.status(500).json({
        message: err.message,
        code: err.code,
        sqlMessage: err.sqlMessage,
    });
}
}

module.exports = { logAction };

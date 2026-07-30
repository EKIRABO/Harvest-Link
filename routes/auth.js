const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { logAction } = require("../utils/auditLog");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const VALID_ROLES = ["farmer", "transporter", "storage_provider", "buyer", "admin"];


router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone, password, role, district, sector } = req.body;

    if (!full_name || !password || !role) {
      return res.status(400).json({ error: "full_name, password, and role are required." });
    }
    if (!email && !phone) {
      return res.status(400).json({ error: "Provide either an email or a phone number." });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)",
      [email || null, phone || null]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email or phone already exists." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, district, sector)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email || null, phone || null, password_hash, role, district || null, sector || null]
    );

    await logAction(result.insertId, "register", `New ${role} account created.`);

    res.status(201).json({
      message: "Account created successfully. You can now log in.",
      user_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/phone and password are required." });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_active = 1",
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await logAction(user.user_id, "login", `User logged in.`);

    res.json({
      message: `Welcome back, ${user.full_name}.`,
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        role: user.role,
        district: user.district,
        sector: user.sector,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, phone, role, district, sector, created_at FROM users WHERE user_id = ?",
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch profile." });
  }
});


router.put("/profile", verifyToken, async (req, res) => {
  const { full_name, district, sector } = req.body;
  try {
    await pool.query(
      "UPDATE users SET full_name = COALESCE(?, full_name), district = COALESCE(?, district), sector = COALESCE(?, sector) WHERE user_id = ?",
      [full_name || null, district || null, sector || null, req.user.user_id]
    );
    res.json({ message: "Profile updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update profile." });
  }
});


router.put("/password", verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "current_password and new_password are required." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  try {
    const [[user]] = await pool.query("SELECT password_hash FROM users WHERE user_id = ?", [req.user.user_id]);
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
    const new_hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [new_hash, req.user.user_id]);
    await logAction(req.user.user_id, "change_password", "Password changed.");
    res.json({ message: "Password updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update password." });
  }
});


router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "email is required." });
  }

  try {
    const [[user]] = await pool.query("SELECT user_id, full_name FROM users WHERE email = ?", [email]);


    if (!user) {
      return res.json({ message: "If that email is registered, a reset link has been generated." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [user.user_id, tokenHash, expiresAt]
    );

    await logAction(user.user_id, "request_password_reset", "Password reset requested.");

    const resetLink = `/reset-password.html?token=${rawToken}`;
    res.json({
      message: "Reset link generated (no email service configured yet — shown directly for now).",
      reset_link: resetLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process request." });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: "token and new_password are required." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [[reset]] = await pool.query(
      "SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()",
      [tokenHash]
    );
    if (!reset) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const new_hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [new_hash, reset.user_id]);
    await pool.query("UPDATE password_resets SET used = 1 WHERE reset_id = ?", [reset.reset_id]);

    await logAction(reset.user_id, "reset_password", "Password reset via forgot-password link.");

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password." });
  }
});

module.exports = router;
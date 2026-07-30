
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAction } = require("../utils/auditLog");

const router = express.Router();


const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "produce");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const ALLOWED_TYPES = [".jpg", ".jpeg", ".png", ".webp"];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return cb(new Error("Only JPG, PNG, or WEBP images are allowed."));
    }
    cb(null, true);
  },
});


router.get("/", verifyToken, async (req, res) => {
  try {
    const { district, crop, status } = req.query;
    let query = `
      SELECT pl.*, u.full_name AS farmer_name, u.phone AS farmer_phone
      FROM produce_listings pl
      JOIN users u ON pl.farmer_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (district) {
      query += " AND pl.district = ?";
      params.push(district);
    }
    if (crop) {
      query += " AND pl.crop_name LIKE ?";
      params.push(`%${crop}%`);
    }
    query += status ? " AND pl.status = ?" : " AND pl.status = 'available'";
    params.push(status || "available");

    query += " ORDER BY pl.created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json({ listings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch produce listings." });
  }
});


router.get("/mine", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM produce_listings WHERE farmer_id = ? ORDER BY created_at DESC",
      [req.user.user_id]
    );
    res.json({ listings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your listings." });
  }
});


router.post("/", verifyToken, requireRole("farmer"), (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { crop_name, quantity, unit, price_per_unit, harvest_date, district, sector, description } = req.body;

    if (!crop_name || !quantity) {
      return res.status(400).json({ error: "crop_name and quantity are required." });
    }

    const image_url = req.file ? `/uploads/produce/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO produce_listings
       (farmer_id, crop_name, quantity, available_quantity, unit, price_per_unit, harvest_date, district, sector, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        crop_name,
        quantity,
        quantity,
        unit || "kg",
        price_per_unit || null,
        harvest_date || null,
        district || null,
        sector || null,
        description || null,
        image_url,
      ]
    );

    await logAction(req.user.user_id, "create_listing", `Created produce listing: ${crop_name}.`);

    res.status(201).json({ message: "Produce listing created.", listing_id: result.insertId, image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create listing." });
  }
});


router.put("/:id", verifyToken, requireRole("farmer"), (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(
      "SELECT * FROM produce_listings WHERE listing_id = ? AND farmer_id = ?",
      [id, req.user.user_id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Listing not found or you do not own it." });
    }

    const { crop_name, quantity, unit, price_per_unit, harvest_date, district, sector, description, status } = req.body;
    const current = existing[0];

    let image_url = current.image_url;
    if (req.file) {
     
      if (current.image_url) {
        const oldPath = path.join(UPLOAD_DIR, path.basename(current.image_url));
        fs.unlink(oldPath, () => {});
      }
      image_url = `/uploads/produce/${req.file.filename}`;
    }


    const newQuantity = quantity ?? current.quantity;
    const quantityDelta = Number(newQuantity) - Number(current.quantity);
    const newAvailable = Math.max(0, Number(current.available_quantity) + quantityDelta);

    await pool.query(
      `UPDATE produce_listings SET
        crop_name = ?, quantity = ?, available_quantity = ?, unit = ?, price_per_unit = ?,
        harvest_date = ?, district = ?, sector = ?, description = ?, status = ?, image_url = ?
       WHERE listing_id = ?`,
      [
        crop_name ?? current.crop_name,
        newQuantity,
        newAvailable,
        unit ?? current.unit,
        price_per_unit ?? current.price_per_unit,
        harvest_date ?? current.harvest_date,
        district ?? current.district,
        sector ?? current.sector,
        description ?? current.description,
        status ?? current.status,
        image_url,
        id,
      ]
    );

    await logAction(req.user.user_id, "update_listing", `Updated produce listing #${id}.`);

    res.json({ message: "Listing updated.", image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update listing." });
  }
});


router.delete("/:id", verifyToken, requireRole("farmer"), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(
      "SELECT image_url FROM produce_listings WHERE listing_id = ? AND farmer_id = ?",
      [id, req.user.user_id]
    );
    const [result] = await pool.query(
      "DELETE FROM produce_listings WHERE listing_id = ? AND farmer_id = ?",
      [id, req.user.user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Listing not found or you do not own it." });
    }
    if (existing[0]?.image_url) {
      const filePath = path.join(UPLOAD_DIR, path.basename(existing[0].image_url));
      fs.unlink(filePath, () => {});
    }

    await logAction(req.user.user_id, "delete_listing", `Deleted produce listing #${id}.`);

    res.json({ message: "Listing removed." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove listing." });
  }
});

module.exports = router;
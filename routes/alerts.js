const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const SHELF_LIFE_DAYS = {
  tomato: 3, tomatoes: 3,
  avocado: 5, avocados: 5,
  banana: 5, bananas: 5, matoke: 5,
  mango: 5, mangoes: 5,
  cabbage: 10,
  "irish potato": 30, potatoes: 30, potato: 30,
  "sweet potato": 14, "sweet potatoes": 14,
  cassava: 7,
  beans: 180,
  maize: 180, corn: 180,
  rice: 180,
  sorghum: 180,
  coffee: 365,
};

function shelfLifeFor(cropName) {
  const key = (cropName || "").trim().toLowerCase();
  return SHELF_LIFE_DAYS[key] || 7;
}

router.get("/food-loss", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pl.listing_id, pl.crop_name, pl.quantity, pl.unit, pl.harvest_date,
              pl.district, pl.status, u.full_name AS farmer_name, u.phone AS farmer_phone,
              DATEDIFF(CURDATE(), pl.harvest_date) AS days_since_harvest
       FROM produce_listings pl
       JOIN users u ON pl.farmer_id = u.user_id
       WHERE pl.status = 'available' AND pl.harvest_date IS NOT NULL
       ORDER BY pl.harvest_date ASC`
    );

    const alerts = rows
      .map((r) => {
        const shelfLife = shelfLifeFor(r.crop_name);
        const ratio = r.days_since_harvest / shelfLife;
        let risk_level = "safe";
        if (ratio >= 1) risk_level = "critical";
        else if (ratio >= 0.7) risk_level = "at_risk";
        return { ...r, shelf_life_days: shelfLife, risk_level };
      })
      .filter((r) => r.risk_level !== "safe");

    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not compute food loss alerts." });
  }
});


router.get("/storage-capacity", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.user_id, sp.facility_name, sp.capacity_tons, sp.available_capacity_tons,
              sp.district, sp.status, u.full_name AS provider_name, u.phone AS provider_phone
       FROM storage_profiles sp
       JOIN users u ON sp.user_id = u.user_id
       WHERE sp.capacity_tons > 0 AND sp.status != 'closed'`
    );

    const alerts = rows
      .map((r) => {
        const ratio = r.available_capacity_tons / r.capacity_tons;
        let risk_level = "ok";
        if (ratio <= 0.15) risk_level = "critical";
        else if (ratio <= 0.3) risk_level = "low";
        return { ...r, availability_ratio: ratio, risk_level };
      })
      .filter((r) => r.risk_level !== "ok");

    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not compute storage capacity alerts." });
  }
});

module.exports = router;
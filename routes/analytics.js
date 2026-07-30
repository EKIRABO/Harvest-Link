const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");


router.get("/overview", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [[userCounts]] = await pool.query(`
      SELECT
        SUM(role = 'farmer') AS farmers,
        SUM(role = 'transporter') AS transporters,
        SUM(role = 'storage_provider') AS storage_providers,
        SUM(role = 'buyer') AS buyers
      FROM users
    `);
    const [[listingCounts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_listings,
        SUM(status = 'available') AS available,
        SUM(status = 'sold') AS sold
      FROM produce_listings
    `);
    const [[deliveryCounts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_requests,
        SUM(status = 'pending') AS pending,
        SUM(status = 'accepted') AS accepted,
        SUM(status = 'in_transit') AS in_transit,
        SUM(status = 'delivered') AS delivered,
        SUM(status = 'cancelled') AS cancelled
      FROM delivery_requests
    `);
    const [[demandCounts]] = await pool.query(`
      SELECT COUNT(*) AS total_demand_posts, SUM(status = 'open') AS open_posts
      FROM market_demand
    `);

    res.json({ users: userCounts, listings: listingCounts, deliveries: deliveryCounts, demand: demandCounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load overview." });
  }
});

router.get("/delivery-performance", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT
        AVG(TIMESTAMPDIFF(HOUR, created_at, accepted_at)) AS avg_hours_to_accept,
        AVG(TIMESTAMPDIFF(HOUR, accepted_at, in_transit_at)) AS avg_hours_to_pickup,
        AVG(TIMESTAMPDIFF(HOUR, in_transit_at, delivered_at)) AS avg_hours_in_transit,
        AVG(TIMESTAMPDIFF(HOUR, created_at, delivered_at)) AS avg_hours_total
      FROM delivery_requests
      WHERE delivered_at IS NOT NULL
    `);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load delivery performance." });
  }
});


router.get("/supply-demand", verifyToken, async (req, res) => {
  try {
    const [supply] = await pool.query(`
      SELECT crop_name, SUM(quantity) AS total_supply
      FROM produce_listings
      WHERE status = 'available'
      GROUP BY crop_name
    `);
    const [demand] = await pool.query(`
      SELECT crop_name, SUM(quantity_needed) AS total_demand
      FROM market_demand
      WHERE status = 'open'
      GROUP BY crop_name
    `);

    const map = {};
    supply.forEach((s) => {
      const key = s.crop_name.trim().toLowerCase();
      map[key] = { crop_name: s.crop_name, total_supply: Number(s.total_supply), total_demand: 0 };
    });
    demand.forEach((d) => {
      const key = d.crop_name.trim().toLowerCase();
      if (!map[key]) map[key] = { crop_name: d.crop_name, total_supply: 0, total_demand: 0 };
      map[key].total_demand = Number(d.total_demand);
    });

    const results = Object.values(map).map((r) => ({
      ...r,
      gap: r.total_demand - r.total_supply,
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load supply/demand data." });
  }
});


router.get("/predictions", verifyToken, async (req, res) => {
  try {
    const [supply] = await pool.query(`
      SELECT crop_name, SUM(quantity) AS total_supply
      FROM produce_listings
      GROUP BY crop_name
    `);
    const [demand] = await pool.query(`
      SELECT crop_name, SUM(quantity_needed) AS total_demand
      FROM market_demand
      GROUP BY crop_name
    `);

    const map = {};
    supply.forEach((s) => {
      const key = s.crop_name.trim().toLowerCase();
      map[key] = { crop_name: s.crop_name, total_supply: Number(s.total_supply), total_demand: 0 };
    });
    demand.forEach((d) => {
      const key = d.crop_name.trim().toLowerCase();
      if (!map[key]) map[key] = { crop_name: d.crop_name, total_supply: 0, total_demand: 0 };
      map[key].total_demand = Number(d.total_demand);
    });

    const insights = Object.values(map)
      .filter((r) => r.total_supply > 0 || r.total_demand > 0)
      .map((r) => {
        const ratio = r.total_supply === 0 ? Infinity : r.total_demand / r.total_supply;
        let insight = "Balanced";
        if (ratio >= 1.5) insight = "Likely undersupplied — consider growing more";
        else if (ratio <= 0.5 && r.total_supply > 0) insight = "Likely oversupplied — demand is lagging";
        return { ...r, insight };
      })
      .filter((r) => r.insight !== "Balanced");

    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate predictions." });
  }
});


router.get("/audit-logs", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT al.*, u.full_name, u.role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.user_id
      ORDER BY al.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load audit logs." });
  }
});


router.get("/export/listings.csv", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pl.listing_id, pl.crop_name, pl.quantity, pl.unit, pl.price_per_unit,
             pl.district, pl.status, pl.created_at, u.full_name AS farmer_name
      FROM produce_listings pl
      JOIN users u ON pl.farmer_id = u.user_id
      ORDER BY pl.created_at DESC
    `);
    const header = "listing_id,crop_name,quantity,unit,price_per_unit,district,status,created_at,farmer_name";
    const lines = rows.map((r) =>
      [r.listing_id, r.crop_name, r.quantity, r.unit, r.price_per_unit, r.district, r.status, r.created_at, r.farmer_name]
        .map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=listings_report.csv");
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not export report." });
  }
});



router.get("/user-summary", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [[counts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(role = 'farmer') AS farmers,
        SUM(role = 'buyer') AS buyers,
        SUM(role = 'transporter') AS transporters,
        SUM(role = 'storage_provider') AS storage_providers,
        SUM(role = 'admin') AS admins,
        SUM(is_active = 0) AS suspended
      FROM users
    `);
    const [[listingCounts]] = await pool.query(`
      SELECT COUNT(*) AS active_listings FROM produce_listings WHERE status = 'available'
    `);
    const [[reservationCounts]] = await pool.query(`
      SELECT COUNT(*) AS total_reservations FROM reservations
    `);
    const [[paymentCounts]] = await pool.query(`
      SELECT COUNT(*) AS total_transactions, COALESCE(SUM(amount), 0) AS total_amount
      FROM payments WHERE status = 'completed'
    `);

    res.json({
      total_users: counts.total_users,
      farmers: counts.farmers,
      buyers: counts.buyers,
      transporters: counts.transporters,
      storage_providers: counts.storage_providers,
      admins: counts.admins,
      suspended: counts.suspended,
      active_listings: listingCounts.active_listings,
      total_reservations: reservationCounts.total_reservations,
      total_transactions: paymentCounts.total_transactions,
      total_transaction_amount: Number(paymentCounts.total_amount),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load user summary." });
  }
});


router.get("/all-listings", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { status, crop, district } = req.query;
    let sql = `
      SELECT pl.*, u.full_name AS farmer_name, u.phone AS farmer_phone
      FROM produce_listings pl
      JOIN users u ON pl.farmer_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += " AND pl.status = ?"; params.push(status); }
    if (crop) { sql += " AND pl.crop_name LIKE ?"; params.push(`%${crop}%`); }
    if (district) { sql += " AND pl.district = ?"; params.push(district); }
    sql += " ORDER BY pl.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json({ listings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load listings." });
  }
});

module.exports = router;
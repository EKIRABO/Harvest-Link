require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");

const authRoutes = require("./routes/auth");
const produceRoutes = require("./routes/produce");
const storageRoutes = require("./routes/storage");
const transportRoutes = require("./routes/transport");
const deliveryRoutes = require("./routes/delivery");
const marketRoutes = require("./routes/market");
const alertsRoutes = require("./routes/alerts");
const analyticsRoutes = require("./routes/analytics");
const messageRoutes = require("./routes/messages");
const notificationRoutes = require("./routes/notifications");
const reservationRoutes = require("./routes/reservations");
const paymentRoutes = require("./routes/payments");
const storageTypesRoutes = require("./routes/storageTypes");
const storageBookingRoutes = require("./routes/storageBookings");
const adminRoutes = require("./routes/admin");
const offlineSalesRoutes = require("./routes/offlineSales");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/produce", produceRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/storage/bookings", storageBookingRoutes);
app.use("/api/storage/types", storageTypesRoutes);
app.use("/api/storage", storageRoutes); 
app.use("/api/admin", adminRoutes);
app.use("/api/offline-sales", offlineSalesRoutes);


app.get("/api/payments/transporter-earnings", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM earnings WHERE provider_id = ? ORDER BY created_at DESC",
      [16]
    );
    const total_amount = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    res.json({ earnings: rows, total_amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch earnings." });
  }
});

app.get("/", (req, res) => {
  res.redirect("/login.html");
});


app.get("/api/health", (req, res) => {
  res.json({ status: "HarvestLink API is running." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`HarvestLink server running on http://localhost:${PORT}`);
});

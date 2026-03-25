const express = require("express");
const cors = require("cors");
require("dotenv").config();

const incidentRoutes = require("./routes/incident.routes");

const cameraRoutes = require("./routes/camera.routes");
const adminRoutes = require("./routes/admin.routes");
const detectRoutes = require("./routes/detect.routes");
const alertRoutes = require("./routes/alert.routes");
const { db } = require("./config/firebase");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api/incidents", incidentRoutes);
app.use("/api/operator", require("./routes/operator"));


app.get("/", (req, res) => {
  res.send("Crime Detection Backend Running 🚓");
});

app.get("/health", async (req, res) => {
  try {
    const result = await db.collection("cameras").limit(1).get();
    res.json({ status: "ok", firebase: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ 
      status: "error", 
      firebase: "disconnected", 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.use("/api/cameras", cameraRoutes);


app.use("/api/admin", adminRoutes);

app.use("/api/detect", detectRoutes);

app.use("/api/alerts", alertRoutes);

app.use("/api/incidents", require("./routes/incident.routes"));


module.exports = app;

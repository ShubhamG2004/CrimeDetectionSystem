const express = require("express");
const cors = require("cors");
require("dotenv").config();

const incidentRoutes = require("./routes/incident.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api/incidents", incidentRoutes);

app.get("/", (req, res) => {
  res.send("Crime Detection Backend Running 🚓");
});

module.exports = app;

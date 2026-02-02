const express = require("express");
const cors = require("cors");
require("dotenv").config();

const incidentRoutes = require("./routes/incident.routes");

const cameraRoutes = require("./routes/camera.routes");
const adminRoutes = require("./routes/admin.routes");
const detectRoutes = require("./routes/detect.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api/incidents", incidentRoutes);

app.get("/", (req, res) => {
  res.send("Crime Detection Backend Running 🚓");
});


app.use("/api/cameras", cameraRoutes);


app.use("/api/admin", adminRoutes);

app.use("/api/detect", detectRoutes);

app.use("/api/incidents", require("./routes/incident.routes"));


module.exports = app;

const express = require("express");
const router = express.Router();

const {
  createIncident,
} = require("../controllers/incident.controller");

// ------------------------------------
// INCIDENT ROUTES
// ------------------------------------

// 🔴 Create new crime incident
// Used by: AI Server / YOLO / Pose Detection
router.post("/create", createIncident);

module.exports = router;

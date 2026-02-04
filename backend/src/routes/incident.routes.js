const express = require("express");
const router = express.Router();

const {
  createIncident,
} = require("../controllers/incident.controller");

// ------------------------------------
// INCIDENT ROUTES
// ------------------------------------

/**
 * 🔴 Create new crime incident
 * Used by:
 *  - AI Image Detection
 *  - YOLO / Pose Detection
 *  - Future CCTV Video Pipelines
 *
 * Body:
 * {
 *   type,
 *   confidence,
 *   cameraId,
 *   imageBase64,
 *   threat_level,
 *   threat_score,
 *   persons_detected,
 *   activities,
 *   signals,
 *   source
 * }
 */
router.post("/create", createIncident);

module.exports = router;

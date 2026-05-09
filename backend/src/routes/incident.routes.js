const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

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

// List incidents for admin dashboards and monitoring pages
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("incidents").orderBy("createdAt", "desc").get();
    const incidents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, data: incidents });
  } catch (err) {
    console.error("❌ FETCH INCIDENTS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch incidents" });
  }
});
module.exports = router;

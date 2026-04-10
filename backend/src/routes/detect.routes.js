const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("../config/cloudinary");
const { admin, db } = require("../config/firebase");
const { findNearestStation } = require("../controllers/policeStation.controller");
const cache = require("../config/cache");
const {
  triggerStationAlert,
  shouldTriggerAlert,
} = require("../services/alert.service");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------------
   🧠 Helper: Safe JSON Parse
-------------------------------------------------- */
const parseJSON = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

/* --------------------------------------------------
   🧠 Decision Source of Truth
-------------------------------------------------- */
// IMPORTANT: Crime decisions come from the Python AI server only.
// Node.js is responsible for transport, persistence, and alert dispatch.

/* --------------------------------------------------
   📥 IMAGE DETECTION ROUTE
-------------------------------------------------- */
router.post("/image", verifyToken, upload.single("image"), async (req, res) => {
  console.log("\n📥 IMAGE DETECTION REQUEST RECEIVED");

  try {
    /* ---------- VALIDATION ---------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    /* ---------- LOCATION ---------- */
    const rawLocation = parseJSON(req.body.location) || {};
    const requestedCameraId = req.body.cameraId || rawLocation.cameraId || null;

    if (!requestedCameraId) {
      return res.status(400).json({
        success: false,
        message: "cameraId is required",
      });
    }

    const cameraSnap = await db.collection("cameras").doc(requestedCameraId).get();
    if (!cameraSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    const cameraData = cameraSnap.data() || {};

    if (cameraData.status === "pending" || cameraData.active === false) {
      return res.status(403).json({
        success: false,
        message: "Camera is not approved/active for detection",
      });
    }

    if (req.user?.role === "operator") {
      const operatorSnap = await db.collection("operators").doc(req.user.uid).get();
      const operatorData = operatorSnap.exists ? operatorSnap.data() : null;
      const assignedCameras = Array.isArray(operatorData?.cameras)
        ? operatorData.cameras
        : [];

      if (!assignedCameras.includes(requestedCameraId)) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this camera",
        });
      }
    }

    if (req.user?.role === "field_operator" && cameraData.addedBy && cameraData.addedBy !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: "This camera does not belong to your field operator account",
      });
    }

    const location = {
      cameraId: requestedCameraId,
      name: cameraData.area || cameraData.location || cameraData.name || "Unknown",
      lat:
        cameraData.latitude !== undefined
          ? Number(cameraData.latitude)
          : rawLocation.lat !== undefined
          ? Number(rawLocation.lat)
          : null,
      lng:
        cameraData.longitude !== undefined
          ? Number(cameraData.longitude)
          : rawLocation.lng !== undefined
          ? Number(rawLocation.lng)
          : null,
    };

    console.log("📍 Location:", location);
    console.log(`🖼️ Image: ${req.file.originalname}`);

    /* ---------- SEND TO AI SERVER ---------- */
    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const aiRes = await axios.post(
      "http://127.0.0.1:8000/detect-image",
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );

    const {
      type = "UNKNOWN",
      confidence = 0,
      threat_level = "LOW",
      threat_score: aiThreatScore = 0,
      persons_detected = 0,
      activities = [],
      signals = [],
      crime_detected: aiCrimeDetected = false,
      timestamp = null,
    } = aiRes.data || {};

    console.log("🧠 AI RESULT:", {
      type,
      confidence,
      threat_level,
      persons_detected,
    });

    const personsCount = Number(persons_detected) || 0;
    const finalSignals = Array.isArray(signals) ? signals : [];
    const finalActivities = Array.isArray(activities) ? activities : [];

    // Trust AI outputs directly. Optional safety override only escalates when
    // score is high but crime_detected is false.
    const threat_score = Number.isFinite(Number(aiThreatScore)) ? Number(aiThreatScore) : 0;
    let finalCrimeDetected = Boolean(aiCrimeDetected);
    let finalCrimeType = type;

    if (!finalCrimeDetected && threat_score > 60) {
      finalCrimeDetected = true;
      finalCrimeType = "Suspicious Activity";
    }

    /* ---------- CLOUDINARY UPLOAD ---------- */
    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: "crime-detection/incidents",
    });

    /* ---------- FIRESTORE SAVE ---------- */
    const incidentData = {
      crime_type: finalCrimeType,
      confidence: Number(confidence) || 0,

      threat_level,
      threat_score,

      cameraId: requestedCameraId,

      persons_detected: personsCount,
      activities: finalActivities,
      signals: finalSignals,
      crime_detected: finalCrimeDetected,

      location, // ✅ ALWAYS CONSISTENT

      imageUrl: uploadRes.secure_url,

      source: "ai-image-detection",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      aiTimestamp: timestamp,
    };

    const docRef = await db.collection("incidents").add(incidentData);
    await cache.delByPrefix("operator:incidents:");

    console.log("✅ INCIDENT SAVED:", docRef.id);

    /* ---------- NEAREST POLICE STATION ---------- */
    let nearestStation = null;
    try {
      nearestStation = await findNearestStation(
        location.lat,
        location.lng
      );
      if (nearestStation) {
        await db
          .collection("incidents")
          .doc(docRef.id)
          .update({ nearestStation });
        console.log(
          `🚓 Nearest station: ${nearestStation.stationName} (${nearestStation.distanceKm} km)`
        );
      }
    } catch (stationErr) {
      console.warn("⚠️ Could not find nearest station:", stationErr.message);
    }

    /* ---------- SOCKET.IO ALERT ---------- */
    const io = req.app.get("io");
    if (io) {
      io.emit("new-incident", {
        id: docRef.id,
        ...incidentData,
        nearestStation,
      });
    }

    if (
      finalCrimeDetected &&
      shouldTriggerAlert({
        threat_level,
        threat_score,
      })
    ) {
      try {
        await triggerStationAlert({
          incidentId: docRef.id,
          incidentData,
          cameraData,
          cameraId: requestedCameraId,
          location,
          nearestStation,
          io,
        });
      } catch (alertErr) {
        console.error("Alert dispatch error:", alertErr.message);
      }
    } else if (!finalCrimeDetected) {
      console.log("ℹ️ Incident stored as non-crime by AI decision");
    }

    return res.status(201).json({
      success: true,
      incidentId: docRef.id,
      data: { ...incidentData, nearestStation },
    });
  } catch (err) {
    console.error("❌ IMAGE DETECT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Crime detection failed",
    });
  }
});

router.post("/esp32-image", upload.single("image"), async (req, res) => {
  console.log("\n📥 ESP32 IMAGE DETECTION REQUEST RECEIVED");

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const rawLocation = parseJSON(req.body.location) || {};
    const requestedCameraId = req.body.cameraId || rawLocation.cameraId || null;
    const suppliedDeviceToken =
      req.headers["x-device-token"] || req.body.deviceToken || null;

    if (!requestedCameraId) {
      return res.status(400).json({
        success: false,
        message: "cameraId is required",
      });
    }

    if (!suppliedDeviceToken) {
      return res.status(401).json({
        success: false,
        message: "x-device-token header is required",
      });
    }

    const cameraSnap = await db.collection("cameras").doc(requestedCameraId).get();
    if (!cameraSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    const cameraData = cameraSnap.data() || {};
    if (cameraData.status === "pending" || cameraData.active === false) {
      return res.status(403).json({
        success: false,
        message: "Camera is not approved/active for detection",
      });
    }

    const expectedToken = cameraData?.esp32?.deviceToken || cameraData?.deviceToken;
    if (!expectedToken) {
      return res.status(412).json({
        success: false,
        message: "Camera is not configured for ESP32 uploads",
      });
    }

    if (String(expectedToken).trim() !== String(suppliedDeviceToken).trim()) {
      return res.status(403).json({
        success: false,
        message: "Invalid ESP32 device token",
      });
    }

    const location = {
      cameraId: requestedCameraId,
      name: cameraData.area || cameraData.location || cameraData.name || "Unknown",
      lat:
        cameraData.latitude !== undefined
          ? Number(cameraData.latitude)
          : rawLocation.lat !== undefined
          ? Number(rawLocation.lat)
          : null,
      lng:
        cameraData.longitude !== undefined
          ? Number(cameraData.longitude)
          : rawLocation.lng !== undefined
          ? Number(rawLocation.lng)
          : null,
    };

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const aiRes = await axios.post("http://127.0.0.1:8000/detect-image", formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

    const {
      type = "UNKNOWN",
      confidence = 0,
      threat_level = "LOW",
      threat_score: aiThreatScore = 0,
      persons_detected = 0,
      activities = [],
      signals = [],
      crime_detected: aiCrimeDetected = false,
      timestamp = null,
    } = aiRes.data || {};

    const personsCount = Number(persons_detected) || 0;
    const finalSignals = Array.isArray(signals) ? signals : [];
    const finalActivities = Array.isArray(activities) ? activities : [];

    // Trust AI outputs directly. Optional safety override only escalates when
    // score is high but crime_detected is false.
    const threat_score = Number.isFinite(Number(aiThreatScore)) ? Number(aiThreatScore) : 0;
    let finalCrimeDetected = Boolean(aiCrimeDetected);
    let finalCrimeType = type;

    if (!finalCrimeDetected && threat_score > 60) {
      finalCrimeDetected = true;
      finalCrimeType = "Suspicious Activity";
    }

    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: "crime-detection/incidents",
    });

    const incidentData = {
      crime_type: finalCrimeType,
      confidence: Number(confidence) || 0,
      threat_level,
      threat_score,
      cameraId: requestedCameraId,
      persons_detected: personsCount,
      activities: finalActivities,
      signals: finalSignals,
      crime_detected: finalCrimeDetected,
      location,
      imageUrl: uploadRes.secure_url,
      source: "esp32-image-detection",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      aiTimestamp: timestamp,
    };

    const docRef = await db.collection("incidents").add(incidentData);
    await cache.delByPrefix("operator:incidents:");

    try {
      await db.collection("cameras").doc(requestedCameraId).update({
        "esp32.lastSeenAt": admin.firestore.FieldValue.serverTimestamp(),
        "esp32.lastUploadStatus": "ok",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (cameraUpdateError) {
      console.warn("⚠️ Could not update ESP32 heartbeat:", cameraUpdateError.message);
    }

    let nearestStation = null;
    try {
      nearestStation = await findNearestStation(location.lat, location.lng);
      if (nearestStation) {
        await db.collection("incidents").doc(docRef.id).update({ nearestStation });
      }
    } catch (stationErr) {
      console.warn("⚠️ Could not find nearest station:", stationErr.message);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("new-incident", {
        id: docRef.id,
        ...incidentData,
        nearestStation,
      });
    }

    if (
      finalCrimeDetected &&
      shouldTriggerAlert({
        threat_level,
        threat_score,
      })
    ) {
      try {
        await triggerStationAlert({
          incidentId: docRef.id,
          incidentData,
          cameraData,
          cameraId: requestedCameraId,
          location,
          nearestStation,
          io,
        });
      } catch (alertErr) {
        console.error("Alert dispatch error:", alertErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      incidentId: docRef.id,
      data: { ...incidentData, nearestStation },
    });
  } catch (err) {
    console.error("❌ ESP32 IMAGE DETECT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Crime detection failed",
    });
  }
});

module.exports = router;

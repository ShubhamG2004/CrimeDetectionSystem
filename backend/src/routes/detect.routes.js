const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("../config/cloudinary");
const { admin, db } = require("../config/firebase");
const { findNearestStation } = require("../controllers/policeStation.controller");
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
   🔢 Helper: Calculate Threat Score (0–100)
-------------------------------------------------- */
const calculateThreatScore = ({ confidence = 0, threat_level = "LOW" }) => {
  let score = Math.round(confidence * 100);

  switch (threat_level.toUpperCase()) {
    case "CRITICAL":
      score += 40;
      break;
    case "HIGH":
      score += 25;
      break;
    case "MEDIUM":
      score += 15;
      break;
    default:
      break;
  }

  return Math.min(100, score);
};

/* --------------------------------------------------
   🧠 Helper: Contextual Threat Filtering
-------------------------------------------------- */
const THREAT_KEYWORDS = {
  weaponSignals: ["GUN", "KNIFE", "STABBING", "WEAPON"],
  violentActivities: ["PHYSICAL_ASSAULT", "SHOOTING_THREAT", "STABBING_ATTACK", "WEAPON_THREAT"],
  suspiciousActivities: ["FOLLOWING_CHASING", "ARMED_THREAT"],
};

const LOCATION_FALSE_POSITIVE_KEYWORDS = ["MARKET", "FISH", "SEAFOOD"];

const toUpperSafe = (value) => String(value || "").toUpperCase();

const sanitizeSignals = (signals = []) => {
  if (!Array.isArray(signals)) return [];
  return signals
    .filter(Boolean)
    .filter((signal) => !toUpperSafe(signal).includes("SEXUAL ASSAULT"));
};

const includesKeyword = (items = [], keywords = []) => {
  if (!Array.isArray(items) || !items.length || !keywords.length) return false;
  const upperItems = items.map((item) => toUpperSafe(item));
  return upperItems.some((item) => keywords.some((keyword) => item.includes(keyword)));
};

const evaluateThreatContext = ({
  signals = [],
  activities = [],
  confidence = 0,
  locationName = "",
  persons = 0,
}) => {
  const sanitizedSignals = sanitizeSignals(signals);
  const normalizedActivities = Array.isArray(activities)
    ? activities.filter(Boolean)
    : [];
  const normalizedPersons = Number(persons) || 0;

  const reasons = [];

  const hasWeapon = includesKeyword(sanitizedSignals, THREAT_KEYWORDS.weaponSignals);
  const hasViolentContext = includesKeyword(normalizedActivities, THREAT_KEYWORDS.violentActivities);
  const hasSuspiciousContext = includesKeyword(
    normalizedActivities,
    THREAT_KEYWORDS.suspiciousActivities
  );

  const requiresMultiplePersons = hasWeapon || normalizedActivities.includes("STABBING_ATTACK");
  const insufficientPersons = requiresMultiplePersons && normalizedPersons < 2;
  if (insufficientPersons) {
    reasons.push("single-person-context");
  }

  const stabbingWithoutAssault =
    normalizedActivities.includes("STABBING_ATTACK") &&
    !normalizedActivities.includes("PHYSICAL_ASSAULT");
  if (stabbingWithoutAssault) {
    reasons.push("stabbing-without-physical-assault");
  }

  if (!hasWeapon) {
    reasons.push("no-weapon-detected");
  }

  if (hasWeapon && !hasViolentContext && !hasSuspiciousContext) {
    reasons.push("weapon-without-context");
  }

  const lowConfidence = Number(confidence) < 0.95;
  if (lowConfidence) {
    reasons.push("confidence-below-0.95");
  }

  const locationLabel = toUpperSafe(locationName);
  const filteredLocation = LOCATION_FALSE_POSITIVE_KEYWORDS.some((keyword) =>
    locationLabel.includes(keyword)
  );

  if (filteredLocation) {
    reasons.push("filtered-location");
  }

  const isRealThreat =
    hasWeapon &&
    (hasViolentContext || hasSuspiciousContext || normalizedActivities.includes("PHYSICAL_ASSAULT")) &&
    !lowConfidence &&
    !filteredLocation &&
    !insufficientPersons &&
    !stabbingWithoutAssault;

  return {
    isRealThreat,
    sanitizedSignals,
    normalizedActivities,
    reasons: isRealThreat ? [] : reasons,
  };
};

const stripSinglePersonMarkers = ({ signals = [], activities = [], persons = 0 }) => {
  const normalizedPersons = Number(persons) || 0;
  if (normalizedPersons >= 2) {
    return { signals, activities };
  }

  const filteredSignals = signals.filter((signal) => {
    const upper = toUpperSafe(signal);
    return !upper.includes("SEXUAL") && !upper.includes("LOWER_BODY");
  });

  const filteredActivities = activities.filter((activity) => {
    const upper = toUpperSafe(activity);
    return !upper.includes("SEXUAL");
  });

  return {
    signals: filteredSignals,
    activities: filteredActivities,
  };
};

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
    const {
      isRealThreat,
      sanitizedSignals,
      normalizedActivities,
      reasons: suppressionReasons,
    } = evaluateThreatContext({
      signals,
      activities,
      confidence,
      locationName: location.name,
      persons: personsCount,
    });

    let finalSignals = sanitizedSignals;
    let finalActivities = normalizedActivities;

    const singlePersonStripped = stripSinglePersonMarkers({
      signals: finalSignals,
      activities: finalActivities,
      persons: personsCount,
    });

    finalSignals = singlePersonStripped.signals;
    finalActivities = singlePersonStripped.activities;

    const finalCrimeDetected = Boolean(aiCrimeDetected) && isRealThreat;

    if (!isRealThreat) {
      console.log("⚠️ Context filter suppressed alert", {
        suppressionReasons,
      });
    }

    /* ---------- THREAT SCORE ---------- */
    const threat_score = calculateThreatScore({
      confidence,
      threat_level,
    });

    /* ---------- CLOUDINARY UPLOAD ---------- */
    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: "crime-detection/incidents",
    });

    /* ---------- FIRESTORE SAVE ---------- */
    const incidentData = {
      crime_type: type,
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
      contextFilter: {
        suppressed: !isRealThreat,
        reasons: suppressionReasons,
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };

    const docRef = await db.collection("incidents").add(incidentData);

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
      isRealThreat &&
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
    } else if (!isRealThreat) {
      console.log("ℹ️ Incident stored but alert suppressed");
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

module.exports = router;

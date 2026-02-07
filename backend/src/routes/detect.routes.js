const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("../config/cloudinary");
const { db } = require("../config/firebase");

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
   📥 IMAGE DETECTION ROUTE
-------------------------------------------------- */
router.post("/image", upload.single("image"), async (req, res) => {
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

    const location = {
      cameraId: rawLocation.cameraId || null,
      name: rawLocation.name || "Unknown",
      lat:
        rawLocation.lat !== undefined
          ? Number(rawLocation.lat)
          : null,
      lng:
        rawLocation.lng !== undefined
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
      timestamp = null,
    } = aiRes.data || {};

    console.log("🧠 AI RESULT:", {
      type,
      confidence,
      threat_level,
      persons_detected,
    });

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

      persons_detected: Number(persons_detected) || 0,
      activities,
      signals,

      location, // ✅ ALWAYS CONSISTENT

      imageUrl: uploadRes.secure_url,

      source: "ai-image-detection",
      createdAt: new Date(),
      aiTimestamp: timestamp,
    };

    const docRef = await db.collection("incidents").add(incidentData);

    console.log("✅ INCIDENT SAVED:", docRef.id);

    return res.status(201).json({
      success: true,
      incidentId: docRef.id,
      data: incidentData,
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

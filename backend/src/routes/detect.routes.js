const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("../config/cloudinary");
const { db } = require("../config/firebase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------------
   🧠 Helper: Safe JSON Parse (for FormData fields)
-------------------------------------------------- */
const parseJSON = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

router.post("/image", upload.single("image"), async (req, res) => {
  console.log("\n📥 IMAGE DETECTION REQUEST RECEIVED");

  try {
    /* ---------------- VALIDATION ---------------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    /* ---------------- PARSE LOCATION ---------------- */
    const location = parseJSON(req.body.location);

    console.log("📍 Parsed Location:", location);
    console.log(
      `🖼️ Image: ${req.file.originalname} (${req.file.mimetype})`
    );

    /* ---------------- 1️⃣ SEND IMAGE TO AI SERVER ---------------- */
    console.log("🤖 Sending image to AI server...");

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Send raw location string to AI (optional)
    if (req.body.location) {
      formData.append("location", req.body.location);
    }

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
      timestamp,
    } = aiRes.data || {};

    console.log("🧠 AI DETECTION RESULT");
    console.log(`   Crime Type     : ${type}`);
    console.log(`   Confidence     : ${(confidence * 100).toFixed(0)}%`);
    console.log(`   Threat Level   : ${threat_level}`);
    console.log(`   People Detected: ${persons_detected}`);

    /* ---------------- 2️⃣ UPLOAD IMAGE TO CLOUDINARY ---------------- */
    console.log("☁️ Uploading image to Cloudinary...");

    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: "crime-detection/incidents",
    });

    console.log("✅ Image uploaded:", uploadRes.secure_url);

    /* ---------------- 3️⃣ SAVE TO FIRESTORE ---------------- */
    console.log("💾 Saving incident to Firestore...");

    const incidentData = {
      crime_type: type,
      confidence: typeof confidence === "number" ? confidence : 0,
      threat_level,

      persons_detected,
      activities,
      signals,

      // ✅ FIXED LOCATION STORAGE
      location: {
        cameraId: location?.cameraId || null,
        name: location?.name || "Unknown",
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      },

      imageUrl: uploadRes.secure_url,

      source: "ai-image-detection",
      createdAt: new Date(),
      aiTimestamp: timestamp || null,
    };

    const docRef = await db.collection("incidents").add(incidentData);

    console.log("✅ INCIDENT SAVED SUCCESSFULLY");
    console.log(`🆔 Incident ID: ${docRef.id}`);
    console.log("--------------------------------------------------");

    /* ---------------- RESPONSE ---------------- */
    return res.status(201).json({
      success: true,
      message: "Crime detected and saved successfully",
      incidentId: docRef.id,
      data: incidentData,
    });
  } catch (err) {
    console.error("❌ AI DETECT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Crime detection failed",
    });
  }
});

module.exports = router;

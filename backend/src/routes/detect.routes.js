const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("../config/cloudinary");
const { db } = require("../config/firebase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/image", upload.single("image"), async (req, res) => {
  console.log("\n📥 IMAGE DETECTION REQUEST RECEIVED");

  try {
    // ---------------- VALIDATION ----------------
    if (!req.file) {
      console.log("❌ No image uploaded");
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
        type: "NO_IMAGE",
        confidence: 0,
        location: req.body.location || "Unknown",
      });
    }

    const location = req.body.location || "Unknown";
    console.log(`📍 Location: ${location}`);
    console.log(
      `🖼️ Image: ${req.file.originalname} (${req.file.mimetype})`
    );

    // ---------------- 1️⃣ SEND IMAGE TO AI SERVER ----------------
    console.log("🤖 Sending image to AI server...");

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append("location", location);

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
    console.log(`   Signals        : ${signals.join(", ") || "None"}`);

    // ---------------- 2️⃣ UPLOAD IMAGE TO CLOUDINARY ----------------
    console.log("☁️ Uploading image to Cloudinary...");

    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const uploadRes = await cloudinary.uploader.upload(
      imageBase64,
      {
        folder: "crime-detection/incidents",
      }
    );

    console.log("✅ Image uploaded to Cloudinary");
    console.log(`   URL: ${uploadRes.secure_url}`);

    // ---------------- 3️⃣ SAVE TO FIRESTORE ----------------
    console.log("💾 Saving incident to Firestore...");

    const incidentData = {
      crime_type: type,
      confidence:
        typeof confidence === "number" ? confidence : 0,
      threat_level,

      persons_detected,
      activities,
      signals,

      location: {
        name: location,
        lat: null,
        lng: null,
      },

      imageUrl: uploadRes.secure_url,

      source: "ai-image-detection",
      createdAt: new Date(),
      aiTimestamp: timestamp || null,
    };

    const docRef = await db
      .collection("incidents")
      .add(incidentData);

    console.log("✅ INCIDENT SAVED SUCCESSFULLY");
    console.log(`🆔 Incident ID: ${docRef.id}`);
    console.log("--------------------------------------------------");

    // ---------------- RESPONSE ----------------
    return res.status(201).json({
      success: true,
      message: "Crime detected and saved successfully",
      incidentId: docRef.id,
      data: incidentData,
    });
  } catch (err) {
    console.error("❌ AI DETECT ERROR:", err.message);
    console.log("--------------------------------------------------");

    return res.status(500).json({
      success: false,
      message: "Crime detection failed",
      type: "ERROR",
      confidence: 0,
      location: req.body?.location || "Unknown",
    });
  }
});

module.exports = router;

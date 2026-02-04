const cloudinary = require("../config/cloudinary");
const { db } = require("../config/firebase");

/**
 * Create & save crime incident
 * 📍 Location is derived from CAMERA (primary source)
 * 🤖 Supports AI-based detections
 */
exports.createIncident = async (req, res) => {
  try {
    const {
      type,
      confidence,
      cameraId,
      imageBase64,

      // AI optional fields
      threat_level,
      threat_score,
      persons_detected,
      activities,
      signals,
      source,
    } = req.body;

    // ---------------- VALIDATION ----------------
    if (
      !type ||
      confidence === undefined ||
      !cameraId ||
      !imageBase64
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // ---------------- 1️⃣ UPLOAD IMAGE ----------------
    const uploadResponse =
      await cloudinary.uploader.upload(imageBase64, {
        folder: "crime-detection/incidents",
      });

    // ---------------- 2️⃣ FETCH CAMERA LOCATION ----------------
    let location = {
      name: "Unknown Camera",
      area: "Unknown Area",
      lat: null,
      lng: null,
    };

    const cameraDoc = await db
      .collection("cameras")
      .doc(cameraId)
      .get();

    if (cameraDoc.exists) {
      const cam = cameraDoc.data();

      location = {
        name: cam.name || "Camera",
        area: cam.area || "Unknown Area",
        lat:
          typeof cam.latitude === "number"
            ? cam.latitude
            : null,
        lng:
          typeof cam.longitude === "number"
            ? cam.longitude
            : null,
      };
    }

    // ---------------- 3️⃣ PREPARE INCIDENT DATA ----------------
    const incidentData = {
      // 🔴 Core
      type,                                // e.g. ASSAULT_WITH_WEAPON
      confidence: Number(confidence),      // 0.0 – 1.0
      threat_level: threat_level || "LOW",
      threat_score: Number(threat_score || 0),
      crime_detected: true,

      // 🎥 Source
      cameraId,
      source: source || "ai-image-detection",

      // 📍 Location (MAP READY)
      location,

      // 🧠 AI Explainability
      persons_detected: Number(persons_detected || 0),
      activities: activities || [],
      signals: signals || [],

      // 🖼 Evidence
      imageUrl: uploadResponse.secure_url,

      // ⏱ Time
      timestamp: new Date(),
      analysis_timestamp: new Date(),
    };

    // ---------------- 4️⃣ SAVE TO FIRESTORE ----------------
    const docRef = await db
      .collection("incidents")
      .add(incidentData);

    // ---------------- 5️⃣ REAL-TIME ALERT (SOCKET.IO) ----------------
    const io = req.app.get("io");
    if (io) {
      io.emit("new-incident", {
        id: docRef.id,
        ...incidentData,
      });
    }

    // ---------------- RESPONSE ----------------
    return res.status(201).json({
      success: true,
      incidentId: docRef.id,
      data: {
        id: docRef.id,
        ...incidentData,
      },
    });

  } catch (error) {
    console.error("❌ Incident Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create incident",
    });
  }
};

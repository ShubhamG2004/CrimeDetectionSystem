const cloudinary = require("../config/cloudinary");
const { admin, db } = require("../config/firebase");
const {
  triggerStationAlert,
  shouldTriggerAlert,
} = require("../services/alert.service");

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

    let cameraData = null;

    const cameraDoc = await db
      .collection("cameras")
      .doc(cameraId)
      .get();

    if (cameraDoc.exists) {
      cameraData = cameraDoc.data();

      location = {
        name: cameraData.name || "Camera",
        area: cameraData.area || "Unknown Area",
        lat:
          typeof cameraData.latitude === "number"
            ? cameraData.latitude
            : null,
        lng:
          typeof cameraData.longitude === "number"
            ? cameraData.longitude
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

    if (shouldTriggerAlert({
      threat_level: incidentData.threat_level,
      threat_score: incidentData.threat_score,
    })) {
      try {
        await triggerStationAlert({
          incidentId: docRef.id,
          incidentData,
          cameraData: cameraData || {},
          cameraId,
          location,
          io,
        });
      } catch (alertErr) {
        console.error("Alert dispatch error:", alertErr.message);
      }
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

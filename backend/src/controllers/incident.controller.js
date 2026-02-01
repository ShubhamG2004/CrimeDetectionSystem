const cloudinary = require("../config/cloudinary");
const { db } = require("../config/firebase");

exports.createIncident = async (req, res) => {
  try {
    const { type, confidence, cameraId, imageBase64 } = req.body;

    // 1️⃣ Upload image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(
      imageBase64,
      {
        folder: "crime-detection/incidents",
      }
    );

    // 2️⃣ Save incident to Firestore
    const incidentData = {
      type,
      confidence,
      cameraId,
      imageUrl: uploadResponse.secure_url,
      timestamp: new Date(),
    };

    const docRef = await db.collection("incidents").add(incidentData);

    return res.status(201).json({
      success: true,
      incidentId: docRef.id,
      data: incidentData,
    });

  } catch (error) {
    console.error("Incident Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create incident",
    });
  }
};

const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

/* ================================
   📋 Get all cameras
   ================================ */
router.get("/", verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection("cameras").get();

    const cameras = snapshot.docs.map((doc) => ({
      cameraId: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(cameras);
  } catch (err) {
    console.error("FETCH CAMERAS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cameras",
    });
  }
});

/* ================================
   ➕ Add camera (ADMIN ONLY)
   ================================ */
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log("ADD CAMERA BODY:", req.body);
    console.log("USER ROLE:", req.user?.role);

    const { name, area, latitude, longitude, active } = req.body;

    if (
      !name ||
      !area ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, area, latitude and longitude are required",
      });
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid numbers",
      });
    }

    const cameraRef = db.collection("cameras").doc();

    await cameraRef.set({
      name,
      area,
      latitude: Number(latitude),
      longitude: Number(longitude),
      active: active ?? true,
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Camera added successfully",
      cameraId: cameraRef.id,
    });
  } catch (err) {
    console.error("ADD CAMERA ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add camera",
    });
  }
});

/* ================================
   ✏️ Update camera (ADMIN)
   ================================ */
router.put("/:cameraId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { name, area, latitude, longitude, active } = req.body;

    await db.collection("cameras").doc(cameraId).update({
      name,
      area,
      latitude: Number(latitude),
      longitude: Number(longitude),
      active: Boolean(active),
      updatedAt: new Date(),
    });

    res.json({ message: "Camera updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update camera" });
  }
});

/* ================================
   🗑️ Delete camera (ADMIN)
   ================================ */
router.delete("/:cameraId", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { cameraId } = req.params;

    await db.collection("cameras").doc(cameraId).delete();

    res.status(200).json({
      success: true,
      message: "Camera deleted successfully",
    });
  } catch (err) {
    console.error("DELETE CAMERA ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete camera",
    });
  }
});

module.exports = router;

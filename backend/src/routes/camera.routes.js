const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
const {
  verifyToken,
  requireAdmin,
} = require("../middleware/auth");

// 📋 Get all cameras (Admin + Operator)
router.get("/", verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection("cameras").get();
    const cameras = snapshot.docs.map((doc) => ({
      cameraId: doc.id,
      ...doc.data(),
    }));
    res.json(cameras);
  } catch {
    res.status(500).json({ message: "Failed to fetch cameras" });
  }
});

// ➕ Add camera (ADMIN ONLY)
router.post(
  "/add",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { cameraId, name, area, latitude, longitude } = req.body;

      if (!cameraId || !name || !area) {
        return res.status(400).json({ message: "Missing fields" });
      }

      await db.collection("cameras").doc(cameraId).set({
        name,
        area,
        latitude,
        longitude,
        active: true,
        createdAt: new Date(),
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to add camera" });
    }
  }
);

// ✏️ Update camera (ADMIN ONLY)
router.put(
  "/:cameraId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { cameraId } = req.params;

      await db.collection("cameras").doc(cameraId).update({
        ...req.body,
        updatedAt: new Date(),
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to update camera" });
    }
  }
);

// 🗑️ Delete camera (ADMIN ONLY)
router.delete(
  "/:cameraId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { cameraId } = req.params;

      await db.collection("cameras").doc(cameraId).delete();
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete camera" });
    }
  }
);

module.exports = router;

const express = require("express");
const router = express.Router();
const { db, admin } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const fetchAssignedStation = async (stationId) => {
  if (!stationId) {
    return null;
  }

  const doc = await db.collection("policeStations").doc(String(stationId)).get();
  if (!doc.exists) {
    const err = new Error("Station not found");
    err.code = "station/not-found";
    throw err;
  }

  const data = doc.data();
  return {
    id: doc.id,
    stationName: data.stationName || "Unknown Station",
    contactNumber: data.contactNumber || null,
    alertEmail: data.alertEmail || null,
    emergencyNumber: data.emergencyNumber || null,
    officerInCharge: data.officerInCharge || null,
    jurisdictionRadius: data.jurisdictionRadius || null,
    location: data.location || null,
  };
};

/* ================================
   📋 Get all cameras
   ================================ */
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log("📸 Fetching cameras for user:", req.user?.uid);
    const snapshot = await db.collection("cameras").get();

    const cameras = snapshot.docs.map((doc) => ({
      cameraId: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Found ${cameras.length} cameras`);
    res.status(200).json(cameras);
  } catch (err) {
    console.error("❌ FETCH CAMERAS ERROR:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch cameras",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
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

    const { name, area, latitude, longitude, active, assignedStationId } = req.body;

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

    let assignedStation = null;
    if (assignedStationId) {
      try {
        assignedStation = await fetchAssignedStation(assignedStationId);
      } catch (stationErr) {
        if (stationErr.code === "station/not-found") {
          return res.status(400).json({
            success: false,
            message: "Assigned police station not found",
          });
        }
        throw stationErr;
      }
    }

    const cameraRef = db.collection("cameras").doc();

    await cameraRef.set({
      name,
      area,
      latitude: Number(latitude),
      longitude: Number(longitude),
      active: active ?? true,
      assignedStation,
      assignedStationId: assignedStation?.id || null,
      assignedStationUpdatedAt: assignedStation
        ? admin.firestore.FieldValue.serverTimestamp()
        : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      success: true,
      message: "Camera added successfully",
      cameraId: cameraRef.id,
      assignedStation,
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
    const {
      name,
      area,
      latitude,
      longitude,
      active,
      assignedStationId,
    } = req.body;

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updates.name = name;
    if (area !== undefined) updates.area = area;

    if (latitude !== undefined) {
      if (isNaN(latitude)) {
        return res.status(400).json({
          success: false,
          message: "Latitude must be a valid number",
        });
      }
      updates.latitude = Number(latitude);
    }

    if (longitude !== undefined) {
      if (isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: "Longitude must be a valid number",
        });
      }
      updates.longitude = Number(longitude);
    }

    if (active !== undefined) updates.active = Boolean(active);

    if (assignedStationId !== undefined) {
      if (assignedStationId) {
        try {
          const assignedStation = await fetchAssignedStation(assignedStationId);
          updates.assignedStation = assignedStation;
          updates.assignedStationId = assignedStation.id;
          updates.assignedStationUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        } catch (stationErr) {
          if (stationErr.code === "station/not-found") {
            return res.status(400).json({
              success: false,
              message: "Assigned police station not found",
            });
          }
          throw stationErr;
        }
      } else {
        updates.assignedStation = null;
        updates.assignedStationId = null;
        updates.assignedStationUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    await db.collection("cameras").doc(cameraId).update(updates);

    res.json({ success: true, message: "Camera updated successfully" });
  } catch (err) {
    console.error("Failed to update camera:", err.message);
    res.status(500).json({ success: false, message: "Failed to update camera" });
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

const express = require("express");
const router = express.Router();
const { admin } = require("../config/firebase");
const { verifyToken } = require("../middleware/auth");

/**
 * ======================================================
 * 🎥 Get cameras assigned to logged-in operator
 * Source: operators collection ONLY
 * ======================================================
 */
router.get("/cameras", verifyToken, async (req, res) => {
  try {
    console.log("🔑 req.user:", req.user);

    const uid = req.user?.uid;
    console.log("👤 Operator UID:", uid);

    const operatorSnap = await admin
      .firestore()
      .collection("operators")
      .doc(uid)
      .get();

    console.log("📄 Operator exists:", operatorSnap.exists);

    if (!operatorSnap.exists) {
      console.log("❌ No operator document");
      return res.json([]);
    }

    const operator = operatorSnap.data();
    console.log("📄 Operator data:", operator);

    if (operator.status !== "active") {
      console.log("❌ Operator inactive");
      return res.json([]);
    }

    const cameraIds = Array.isArray(operator.cameras)
      ? operator.cameras
      : [];

    console.log("🎥 Camera IDs:", cameraIds);

    const cameraDocs = await Promise.all(
      cameraIds.map((id) =>
        admin.firestore().collection("cameras").doc(id).get()
      )
    );

    console.log(
      "📸 Camera docs exist:",
      cameraDocs.map((d) => d.exists)
    );

    const cameras = cameraDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        cameraId: doc.id,
        ...doc.data(),
      }));

    console.log("✅ Cameras returned:", cameras);

    return res.json(cameras);
  } catch (err) {
    console.error("❌ OPERATOR CAMERAS ERROR:", err);
    return res.json([]);
  }
});

/**
 * ======================================================
 * 🏫 Get police stations for authenticated users
 * ======================================================
 */
router.get("/police-stations", verifyToken, async (req, res) => {
  try {
    const role = req.user?.role;
    const uid = req.user?.uid;
    let snap;

    if (role === "field_operator") {
      const fieldOperatorSnap = await admin
        .firestore()
        .collection("field_operator")
        .doc(uid)
        .get();

      if (!fieldOperatorSnap.exists) {
        return res.status(200).json([]);
      }

      const fieldOperator = fieldOperatorSnap.data() || {};
      const creatorAdminUid = fieldOperator.createdBy;

      if (!creatorAdminUid) {
        return res.status(200).json([]);
      }

      snap = await admin
        .firestore()
        .collection("policeStations")
        .where("createdBy", "==", creatorAdminUid)
        .get();
    } else {
      snap = await admin.firestore().collection("policeStations").get();
    }

    const stations = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(stations);
  } catch (err) {
    console.error("❌ POLICE STATIONS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch police stations",
    });
  }
});

/**
 * ======================================================
 * � GET MY CAMERAS (FIELD OPERATOR)
 * Fetch all cameras submitted by the logged-in field operator
 * ======================================================
 */
router.get("/my-cameras", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    // Verify user is a field operator
    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can view their cameras",
      });
    }

    const snap = await admin
      .firestore()
      .collection("cameras")
      .where("addedBy", "==", uid)
      .get();

    const cameras = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() || 0;
        const bMs = b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });

    return res.status(200).json({
      success: true,
      cameras,
      total: cameras.length,
    });
  } catch (err) {
    console.error("❌ GET MY CAMERAS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cameras",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * ======================================================
 * �📷 SUBMIT CAMERA (FIELD OPERATOR)
 * Field operators submit cameras for admin approval
 * ======================================================
 */
router.post("/submit-camera", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    // Verify user is a field operator
    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can submit cameras",
      });
    }

    const {
      cameraName,
      location,
      latitude,
      longitude,
      policeStationId,
      policeStationName,
      description,
    } = req.body;

    // Validate required fields
    if (
      !cameraName ||
      !location ||
      latitude === undefined ||
      longitude === undefined ||
      !policeStationId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "cameraName, location, latitude, longitude, and policeStationId are required",
      });
    }

    // Validate coordinates
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid numbers",
      });
    }

    // Verify police station exists and belongs to field operator's creator
    const policeStationSnap = await admin
      .firestore()
      .collection("policeStations")
      .doc(policeStationId)
      .get();

    if (!policeStationSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Police station not found",
      });
    }

    const fieldOperatorSnap = await admin
      .firestore()
      .collection("field_operator")
      .doc(uid)
      .get();

    if (!fieldOperatorSnap.exists) {
      return res.status(403).json({
        success: false,
        message: "Field operator record not found",
      });
    }

    const creatorAdminUid = fieldOperatorSnap.data()?.createdBy;
    const stationCreator = policeStationSnap.data()?.createdBy;

    if (creatorAdminUid !== stationCreator) {
      return res.status(403).json({
        success: false,
        message:
          "You can only submit cameras to police stations from your admin",
      });
    }

    // Create camera document
    const cameraRef = admin.firestore().collection("cameras").doc();

    const cameraPayload = {
      cameraId: cameraRef.id,
      cameraName: cameraName.trim(),
      location: location.trim(),
      latitude: lat,
      longitude: lng,
      policeStationId,
      policeStationName: policeStationName || policeStationSnap.data()?.stationName,
      description: description ? description.trim() : "",
      fieldOperatorId: uid,
      fieldOperatorName: fieldOperatorSnap.data().name || fieldOperatorSnap.data().email || "Unknown",
      addedBy: uid,
      addedByName: fieldOperatorSnap.data().name || fieldOperatorSnap.data().email || "Unknown",
      status: "pending",
      approvedBy: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),

      // Backward-compatible fields
      name: cameraName.trim(),
      area: location.trim(),
      active: false,
    };

    await cameraRef.set(cameraPayload);

    // Log the activity
    await admin.firestore().collection("operatorLogs").doc().set({
      operatorUid: uid,
      operatorEmail: req.user.email,
      action: "CAMERA_SUBMITTED",
      description: `Field operator submitted camera: ${cameraName}`,
      cameraId: cameraRef.id,
      metadata: {
        location,
        policeStationId,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      message: "Camera submitted successfully. Waiting for admin approval.",
      cameraId: cameraRef.id,
    });
  } catch (err) {
    console.error("❌ SUBMIT CAMERA ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit camera",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = router;

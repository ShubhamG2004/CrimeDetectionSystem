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


module.exports = router;

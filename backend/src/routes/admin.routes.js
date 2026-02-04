const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyToken, requireAdmin } = require("../middleware/auth");

// ➕ CREATE OPERATOR (ADMIN ONLY)
router.post(
  "/create-operator",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { email, password, cameras } = req.body;

    // ---------- VALIDATION ----------
    if (!email || !password || !Array.isArray(cameras) || cameras.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Email, password and at least one camera are required",
      });
    }

    let userRecord = null;

    try {
      // ---------- 1️⃣ CREATE AUTH USER ----------
      userRecord = await Promise.race([
        admin.auth().createUser({
          email,
          password,
          emailVerified: false,
          disabled: false,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Firebase Auth timeout")),
            15000
          )
        ),
      ]);

      const uid = userRecord.uid;

      // ---------- 2️⃣ CREATE FIRESTORE USER ----------
      await admin.firestore().collection("users").doc(uid).set({
        email,
        role: "operator",
        active: true,
        cameras,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.user.uid,
      });

      return res.status(201).json({
        success: true,
        uid,
        message: "Operator created successfully",
      });

    } catch (err) {
      console.error("❌ Create Operator Error:", err.message);

      // ---------- ROLLBACK ----------
      if (userRecord?.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
          console.log("↩ Rolled back auth user");
        } catch (rollbackErr) {
          console.error("❌ Rollback failed:", rollbackErr.message);
        }
      }

      return res.status(500).json({
        success: false,
        message:
          err.message.includes("timeout")
            ? "Firebase is taking too long. Try again."
            : err.message || "Failed to create operator",
      });
    }
  }
);

module.exports = router;

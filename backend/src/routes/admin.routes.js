const express = require("express");
const router = express.Router();
const { admin } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

/* ======================================================
   ➕ CREATE OPERATOR (ADMIN ONLY)
   ====================================================== */
router.post(
  "/create-operator",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { email, password, cameras } = req.body;

    // 🔒 Validation
    if (
      !email ||
      !password ||
      password.length < 6 ||
      !Array.isArray(cameras) ||
      cameras.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email, password (min 6 chars), and at least one camera are required",
      });
    }

    let userRecord;

    // Retry helpers (network-safe)
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isNetworkTimeout = (error) =>
      error?.errorInfo?.code === "app/network-timeout" ||
      /timeout/i.test(error?.message || "");

    const createUserWithRetry = async (payload, attempts = 3) => {
      let lastError;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await admin.auth().createUser(payload);
        } catch (error) {
          lastError = error;
          if (!isNetworkTimeout(error) || attempt === attempts) {
            throw error;
          }
          await sleep(500 * attempt);
        }
      }
      throw lastError;
    };

    try {
      // 1️⃣ Create Firebase Auth user
      userRecord = await createUserWithRetry({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });

      const uid = userRecord.uid;

      // 2️⃣ Create Firestore operator profile
      await admin.firestore().collection("operators").doc(uid).set({
        email,
        role: "operator",
        cameras,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.user.uid,
      });

      return res.status(201).json({
        success: true,
        uid,
        message: "Operator created successfully",
      });
    } catch (err) {
      console.error("❌ CREATE OPERATOR ERROR:", err);

      // Rollback Auth user if Firestore fails
      if (userRecord?.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (rollbackErr) {
          console.error("⚠️ Rollback failed:", rollbackErr.message);
        }
      }

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create operator",
      });
    }
  }
);

/* ======================================================
   🔐 RESET OPERATOR PASSWORD (ADMIN ONLY)
   ====================================================== */
router.post(
  "/reset-operator-password",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { uid, newPassword } = req.body;

      if (!uid || !newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "UID and password (min 6 chars) are required",
        });
      }

      await admin.auth().updateUser(uid, {
        password: newPassword,
      });

      return res.status(200).json({
        success: true,
        message: "Operator password reset successfully",
      });
    } catch (err) {
      console.error("❌ RESET PASSWORD ERROR:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to reset password",
      });
    }
  }
);

module.exports = router;

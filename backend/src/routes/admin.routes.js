const express = require("express");
const router = express.Router();
const { admin } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

/**
 * ======================================================
 * ➕ CREATE OPERATOR (ADMIN ONLY)
 * ======================================================
 * Creates:
 * 1️⃣ Firebase Auth user (email + password)
 * 2️⃣ Firestore operator profile
 *
 * Firestore:
 * operators/{uid}
 * ======================================================
 */
router.post(
  "/create-operator",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { email, password, cameras } = req.body;

    if (!email || !password || !Array.isArray(cameras) || cameras.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Email, password and at least one camera are required",
      });
    }

    let userRecord;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isNetworkTimeout = (error) =>
      error?.errorInfo?.code === "app/network-timeout" ||
      /timeout/i.test(error?.message || "");
    const createUserWithRetry = async (payload, attempts = 3) => {
      let lastError;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
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
      // ✅ CREATE AUTH USER (RETRY ON NETWORK TIMEOUT)
      userRecord = await createUserWithRetry({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });

      const uid = userRecord.uid;

      // ✅ CREATE OPERATOR PROFILE
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
      console.error("❌ Create Operator Error:", err);

      // Rollback auth user if Firestore fails
      if (userRecord?.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (e) {
          console.error("Rollback failed:", e.message);
        }
      }

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create operator",
      });
    }
  }
);


module.exports = router;

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
    try {
      const { email, password, cameras } = req.body;

      if (!email || !password || !cameras?.length) {
        return res.status(400).json({
          message: "Email, password and cameras are required",
        });
      }

      // 1️⃣ Create Auth user
      const userRecord = await admin.auth().createUser({
        email,
        password,
      });

      const uid = userRecord.uid;

      // 2️⃣ Create Firestore user record
      await admin.firestore().collection("users").doc(uid).set({
        email,
        role: "operator",
        active: true,
        cameras,
        createdAt: new Date(),
      });

      res.json({
        success: true,
        uid,
        message: "Operator created successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: err.message || "Failed to create operator",
      });
    }
  }
);

module.exports = router;

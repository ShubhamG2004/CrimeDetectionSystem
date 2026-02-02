const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data"); // ✅ REQUIRED

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        type: "NO_IMAGE",
        confidence: 0,
        location: req.body.location || "Unknown",
      });
    }

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append(
      "location",
      req.body.location || "Unknown"
    );

    const aiRes = await axios.post(
      "http://127.0.0.1:8000/detect-image",
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );

    // ✅ FORCE SAFE RESPONSE
    const {
      type = "UNKNOWN",
      confidence = 0,
      location = "Unknown",
    } = aiRes.data || {};

    return res.json({
      type,
      confidence:
        typeof confidence === "number" ? confidence : 0,
      location,
    });
  } catch (err) {
    console.error("AI ERROR:", err.message);

    return res.status(500).json({
      type: "ERROR",
      confidence: 0,
      location: req.body.location || "Unknown",
    });
  }
});

module.exports = router;

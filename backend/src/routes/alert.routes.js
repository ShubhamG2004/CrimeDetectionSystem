const express = require("express");
const {
  listAlerts,
  getAlert,
  updateAlertStatus,
} = require("../controllers/alert.controller");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, listAlerts);
router.get("/:id", verifyToken, getAlert);
router.patch("/:id/status", verifyToken, updateAlertStatus);

module.exports = router;

const express = require("express");
const router = express.Router();
const analyticsCtrl = require("../controllers/analytics.controller");
const { verifyToken, requireAdmin } = require("../middleware/auth");

/**
 * GET /api/analytics/dashboard-data
 * Get all analytics data for the dashboard
 * Admin only
 */
router.get("/dashboard-data", verifyToken, requireAdmin, analyticsCtrl.getAnalyticsData);

/**
 * GET /api/analytics/incident-stats
 * Get incident statistics summary
 * Admin only
 */
router.get("/incident-stats", verifyToken, requireAdmin, analyticsCtrl.getIncidentStats);

module.exports = router;

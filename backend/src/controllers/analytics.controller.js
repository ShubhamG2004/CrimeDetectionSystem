const { db } = require("../config/firebase");

/**
 * Convert Firestore Timestamp to Date
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // Handle Firestore Timestamp objects
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Handle regular Date objects
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Handle millisecond timestamps
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  // Try to parse as date string
  try {
    return new Date(timestamp);
  } catch {
    return null;
  }
};

/**
 * Get analytics data for dashboard
 * Admin only endpoint
 */
exports.getAnalyticsData = async (req, res) => {
  try {
    console.log("📊 Fetching analytics data...");
    
    // Get all incidents from Firestore
    const incidentsSnapshot = await db.collection("incidents").get();
    const incidents = incidentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`📈 Found ${incidents.length} incidents`);

    // Process daily data
    const dailyMap = {};
    incidents.forEach((incident) => {
      try {
        const timestamp = formatTimestamp(incident.createdAt || incident.timestamp);
        if (timestamp) {
          const date = timestamp.toLocaleDateString();
          dailyMap[date] = (dailyMap[date] || 0) + 1;
        }
      } catch (e) {
        console.warn("Error processing incident timestamp:", e.message);
      }
    });

    const dailyData = Object.keys(dailyMap)
      .sort()
      .map((date) => ({
        date,
        count: dailyMap[date],
      }));

    // Process severity data
    const severityMap = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    incidents.forEach((incident) => {
      const confidence = incident.confidence || 0;
      let severity;
      if (confidence >= 0.8) severity = "HIGH";
      else if (confidence >= 0.6) severity = "MEDIUM";
      else severity = "LOW";

      severityMap[severity]++;
    });

    const severityData = Object.keys(severityMap).map((severity) => ({
      name: severity,
      value: severityMap[severity],
    }));

    // Process camera data
    const cameraMap = {};
    incidents.forEach((incident) => {
      const cameraId = incident.cameraId || "Unknown";
      cameraMap[cameraId] = (cameraMap[cameraId] || 0) + 1;
    });

    const cameraData = Object.keys(cameraMap)
      .sort((a, b) => cameraMap[b] - cameraMap[a]) // Sort by count descending
      .map((cameraId) => ({
        camera: cameraId,
        count: cameraMap[cameraId],
      }));

    console.log("✅ Analytics data processed successfully");

    res.json({
      success: true,
      data: {
        dailyData,
        severityData,
        cameraData,
        totalIncidents: incidents.length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching analytics data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data",
      error: error.message,
    });
  }
};

/**
 * Get incident statistics summary
 */
exports.getIncidentStats = async (req, res) => {
  try {
    const incidentsSnapshot = await db.collection("incidents").get();
    const incidents = incidentsSnapshot.docs.map((doc) => doc.data());

    const stats = {
      total: incidents.length,
      acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
      resolved: incidents.filter((i) => i.status === "resolved").length,
      pending: incidents.filter((i) => !i.status || i.status === "pending").length,
      criticalCount: incidents.filter((i) => (i.confidence || 0) >= 0.8).length,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching incident stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch incident stats",
      error: error.message,
    });
  }
};

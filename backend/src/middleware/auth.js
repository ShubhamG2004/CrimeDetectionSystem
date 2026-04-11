const { admin } = require("../config/firebase");
const { logOperatorActivity } = require("../utils/logOperatorActivity");

/* =========================================
   🔐 VERIFY TOKEN (FINAL)
   ========================================= */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);

    // ✅ Attach user to request
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: decoded.role || null,
    };

    // ✅ Log operator login (non-blocking)
    if (decoded.role === "operator") {
      logOperatorActivity({
        operatorUid: decoded.uid,
        operatorEmail: decoded.email,
        action: "LOGIN",
        description: "Operator logged in",
        ipAddress: req.ip,
      }).catch(() => {});
    }

    next();
  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/* =========================================
   🛡️ REQUIRE ADMIN (FINAL)
   ========================================= */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

module.exports = { verifyToken, requireAdmin };

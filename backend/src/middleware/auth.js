const { admin } = require("../config/firebase");

/**
 * Verify Firebase Auth token
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // uid, email, etc.

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Allow only ADMIN users
 */
const requireAdmin = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists || userDoc.data().role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Authorization failed" });
  }
};

module.exports = {
  verifyToken,
  requireAdmin,
};

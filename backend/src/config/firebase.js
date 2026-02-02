const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-admin.json");

// ✅ Prevent re-initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };

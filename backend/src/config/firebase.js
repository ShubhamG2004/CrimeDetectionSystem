const admin = require("firebase-admin");
<<<<<<< HEAD
const path = require("path");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, "../../firebase-admin.json");

const serviceAccount = require(serviceAccountPath);
=======
const serviceAccount = require("../../firebase-admin.json");
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9

// ✅ Prevent re-initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
<<<<<<< HEAD
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
=======
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
  });
}

const db = admin.firestore();

module.exports = { admin, db };

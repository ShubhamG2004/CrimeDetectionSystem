const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, "./firebase-admin.json");

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
});

(async () => {
  try {
    await admin.auth().createUser({
      email: "healthcheck@test.com",
      password: "Test@12345",
    });
    console.log("✅ Firebase Admin WORKS");
    process.exit(0);
  } catch (e) {
    console.error("❌ Firebase Admin FAILED");
    console.error(e);
    process.exit(1);
  }
})();

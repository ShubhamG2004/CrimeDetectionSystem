const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

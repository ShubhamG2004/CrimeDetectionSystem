const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(
  __dirname,
  "..",
  "firebase-admin.json"
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "TiO7hKpgdocQ1M1F8DRvIF2ceX83";

admin.auth().setCustomUserClaims(uid, {
  role: "operator",
})
.then(() => {
  console.log("✅ Operator role assigned successfully");
  process.exit(0);
})
.catch((err) => {
  console.error("❌ Error assigning role:", err);
  process.exit(1);
});

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

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node setRole.js <email-or-uid> <role>");
  console.log("Example: node setRole.js user@example.com field_operator");
  console.log("Example: node setRole.js TiO7hKpgdocQ1M1F8DRvIF2ceX83 field_operator");
  process.exit(1);
}

const emailOrUid = args[0];
const role = args[1];

const validRoles = ["admin", "field_operator", "operator"];
if (!validRoles.includes(role)) {
  console.error("Invalid role. Must be one of:", validRoles);
  process.exit(1);
}

// First, try to get user by email if it looks like an email
const getUserUid = async (identifier) => {
  if (identifier.includes("@")) {
    try {
      const userRecord = await admin.auth().getUserByEmail(identifier);
      return userRecord.uid;
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.error(`❌ User not found with email: ${identifier}`);
        process.exit(1);
      }
      throw err;
    }
  }
  // If not an email, assume it's a UID
  return identifier;
};

(async () => {
  try {
    const uid = await getUserUid(emailOrUid);
    console.log(`Setting role "${role}" for UID: ${uid}...`);

    await admin.auth().setCustomUserClaims(uid, { role });
    
    // Also update Firestore if field_operator role
    if (role === "field_operator") {
      await admin.firestore().collection("field_operator").doc(uid).set(
        {
          role: "field_operator",
          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    console.log(`✅ Role "${role}" assigned successfully to ${emailOrUid}`);
    console.log("⚠️  User must log out and log back in for changes to take effect.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error assigning role:", err.message);
    process.exit(1);
  }
})();

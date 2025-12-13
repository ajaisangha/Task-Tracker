// setAdmin.js
import admin from "firebase-admin";
import fs from "fs";

// Load service account key
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const ADMINS = [
  "ajaipal.sangha@sobeys.com",
  "abin.thomas@sobeys.com",
  "ishant.pruthi@sobeys.com",
];

async function setAdmins() {
  for (const email of ADMINS) {
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
    });

    console.log(`✅ Admin claim set for ${email}`);
  }

  process.exit();
}

setAdmins();

import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
}

export const db = admin.firestore();
export const timestamp = admin.firestore.FieldValue.serverTimestamp;
export const auth = admin.auth();

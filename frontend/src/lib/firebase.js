import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!apiKey) {
  console.error(
    "Missing NEXT_PUBLIC_FIREBASE_API_KEY. Add it to frontend/.env.local and restart the Next.js server."
  );
}

const firebaseConfig = {
  apiKey,
  authDomain: "crime-detection-system-734c6.firebaseapp.com",
  projectId: "crime-detection-system-734c6",
  storageBucket: "crime-detection-system-734c6.firebasestorage.app",
  messagingSenderId: "500709121041",
  appId: "1:500709121041:web:ed970480dc4da088b7a5b0",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ EXPORT BOTH
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

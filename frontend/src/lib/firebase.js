import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

<<<<<<< HEAD
const firebaseConfig = {
  apiKey: "AIzaSyCpjPrB-2S6tNfoV4YSHqAfbfaC7tfCmus",
  authDomain: "crimedetectionsystem-488706.firebaseapp.com",
  projectId: "crimedetectionsystem-488706",
  storageBucket: "crimedetectionsystem-488706.firebasestorage.app",
  messagingSenderId: "936289746240",
  appId: "1:936289746240:web:4339c94a38fa480af90ea5",
  measurementId: "G-3T7XXK74CM",
=======
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
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ EXPORT BOTH
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

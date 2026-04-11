import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCpjPrB-2S6tNfoV4YSHqAfbfaC7tfCmus",
  authDomain: "crimedetectionsystem-488706.firebaseapp.com",
  projectId: "crimedetectionsystem-488706",
  storageBucket: "crimedetectionsystem-488706.firebasestorage.app",
  messagingSenderId: "936289746240",
  appId: "1:936289746240:web:4339c94a38fa480af90ea5",
  measurementId: "G-3T7XXK74CM",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ EXPORT BOTH
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/** The video-maker-e4002 project. A web config is public by design; the Firestore rules (firestore.rules) guard the data. */
const firebaseConfig = {
  apiKey: "AIzaSyAvIVCLzaFNz357aOEoq9fj8LMtxJmHKr4",
  authDomain: "video-maker-e4002.firebaseapp.com",
  projectId: "video-maker-e4002",
  storageBucket: "video-maker-e4002.firebasestorage.app",
  messagingSenderId: "499060143599",
  appId: "1:499060143599:web:6f005472feab0f65a1b21a",
  measurementId: "G-E7XZ96YCVC",
};

let app: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export const db = (): Firestore => getFirestore(firebaseApp());

/** Google Analytics through Firebase, only in browsers that support it and only on the real site. */
export async function startAnalytics() {
  if (typeof window === "undefined" || location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(firebaseApp());
}

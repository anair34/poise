import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";

/**
 * Browser-side Firebase, used for one job only: proving who the user is.
 *
 * These NEXT_PUBLIC_ values are not secrets — they identify the project and
 * ship to every visitor by design. What protects your data is the Firestore
 * rules and the fact that no browser writes to Firestore directly; all reads
 * and writes go through server code holding the Admin SDK credentials.
 */

const APP_NAME = "poise-web";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export function isFirebaseClientConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

function getClientApp(): FirebaseApp {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return getApp(APP_NAME);

  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase web config is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID.",
    );
  }

  return initializeApp(
    {
      apiKey: config.apiKey!,
      authDomain: config.authDomain!,
      projectId: config.projectId!,
    },
    APP_NAME,
  );
}

export function getClientAuth(): Auth {
  return getAuth(getClientApp());
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser. Without this, someone signed into several Google
  // accounts gets silently reattached to whichever one Google prefers.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

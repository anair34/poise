import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";

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
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Auth itself needs only these three. `appId` is sent when present — it
 * identifies the specific web app to Firebase — but a missing one must not
 * take sign-in down, so it is not part of this gate.
 */
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
      ...(config.appId ? { appId: config.appId } : {}),
    },
    APP_NAME,
  );
}

let authInstance: Auth | undefined;

export function getClientAuth(): Auth {
  if (authInstance) return authInstance;

  const auth = getAuth(getClientApp());

  // Survive a refresh and a closed tab. This is the SDK default, but stating it
  // means a future change to that default cannot silently sign everyone out on
  // reload. The promise is fire-and-forget: it resolves before any sign-in call
  // that follows, and a failure (private mode, storage disabled) should degrade
  // to an in-memory session rather than block sign-in entirely.
  void setPersistence(auth, browserLocalPersistence).catch(() => {});

  authInstance = auth;
  return auth;
}

let provider: GoogleAuthProvider | undefined;

/**
 * One provider instance for the lifetime of the page.
 *
 * `signInWithPopup` reads the provider's parameters at call time, so a single
 * configured instance behaves identically to a fresh one — and reusing it keeps
 * the custom parameters in exactly one place.
 */
export function googleProvider(): GoogleAuthProvider {
  if (provider) return provider;

  const created = new GoogleAuthProvider();
  // Always show the chooser. Without this, someone signed into several Google
  // accounts gets silently reattached to whichever one Google prefers.
  created.setCustomParameters({ prompt: "select_account" });
  provider = created;
  return created;
}

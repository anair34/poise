import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APP_NAME = "poise-admin";

export class FirebaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

/**
 * Private keys arrive from env with literal "\n" sequences (and sometimes
 * wrapped in quotes by the shell or dashboard). Normalize both.
 */
function normalizePrivateKey(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
}

export function isFirebaseConfigured(): boolean {
  if (process.env.FIRESTORE_EMULATOR_HOST) return true;
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getAdminApp(): App {
  // getApps() is checked first so hot reload reuses the existing instance
  // instead of throwing on a duplicate app name.
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return getApp(APP_NAME);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // The local emulator ignores credentials, so only a project id is needed.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp(
      { projectId: projectId ?? "poise-dev" },
      APP_NAME,
    );
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseConfigError(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKey),
      }),
    },
    APP_NAME,
  );
}

// Pinned to globalThis so hot reload reuses one Firestore instance. Calling
// settings() twice on the same instance throws, so this must survive HMR.
const globalCache = globalThis as typeof globalThis & {
  __poiseFirestore?: Firestore;
};

export function getDb(): Firestore {
  if (globalCache.__poiseFirestore) return globalCache.__poiseFirestore;

  const db = getFirestore(getAdminApp());
  db.settings({ ignoreUndefinedProperties: true });
  globalCache.__poiseFirestore = db;
  return db;
}

/** Admin auth, used to verify ID tokens and mint session cookies. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

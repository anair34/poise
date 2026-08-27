"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  getClientAuth,
  googleProvider,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { CANCELLED, authErrorMessage } from "@/lib/auth/errors";

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Either the sign-in succeeded, or it failed with a message worth showing. */
export type AuthResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

interface AuthContextValue {
  user: SessionUser | null;
  isPending: boolean;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (input: {
    name?: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  sendReset: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  cancelled: false,
  message: "Sign-in isn't configured yet.",
};

function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
  };
}

/** Trades an ID token for the httpOnly session cookie the server reads. */
async function establishCookie(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Could not sign you in.");
  }
}

function toResult(caught: unknown): AuthResult {
  const message = authErrorMessage(caught);
  if (message === CANCELLED) return { ok: false, cancelled: true };
  return { ok: false, cancelled: false, message };
}

/**
 * `initialUser` comes from the verified session cookie during server render, so
 * the first paint already knows who is signed in. Without it the UI would flash
 * a signed-out state on every load while the client SDK rehydrates.
 */
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [isPending, setIsPending] = useState(false);
  const isRepairing = useRef(false);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  // The browser can hold a valid Firebase session after the server cookie has
  // expired (the cookie lasts two weeks; the SDK's refresh token far longer).
  // When that happens, mint a fresh cookie rather than making the user sign in
  // again for no visible reason.
  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;

    return onIdTokenChanged(getClientAuth(), (firebaseUser) => {
      if (!firebaseUser || user || isRepairing.current) return;

      isRepairing.current = true;
      void establishCookie(firebaseUser)
        .then(() => {
          setUser(toSessionUser(firebaseUser));
          router.refresh();
        })
        .catch(() => {
          // Leave the user signed out; the forms still work.
        })
        .finally(() => {
          isRepairing.current = false;
        });
    });
  }, [router, user]);

  /** Shared tail of every successful sign-in. */
  const complete = useCallback(
    async (firebaseUser: User): Promise<AuthResult> => {
      await establishCookie(firebaseUser);
      setUser(toSessionUser(firebaseUser));
      router.refresh();
      return { ok: true };
    },
    [router],
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!isFirebaseClientConfigured()) return NOT_CONFIGURED;
    setIsPending(true);
    try {
      const credential = await signInWithPopup(
        getClientAuth(),
        googleProvider(),
      );
      return await complete(credential.user);
    } catch (caught) {
      return toResult(caught);
    } finally {
      setIsPending(false);
    }
  }, [complete]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!isFirebaseClientConfigured()) return NOT_CONFIGURED;
      setIsPending(true);
      try {
        const credential = await signInWithEmailAndPassword(
          getClientAuth(),
          email.trim(),
          password,
        );
        return await complete(credential.user);
      } catch (caught) {
        return toResult(caught);
      } finally {
        setIsPending(false);
      }
    },
    [complete],
  );

  const signUpWithEmail = useCallback(
    async ({
      name,
      email,
      password,
    }: {
      name?: string;
      email: string;
      password: string;
    }): Promise<AuthResult> => {
      if (!isFirebaseClientConfigured()) return NOT_CONFIGURED;
      setIsPending(true);
      try {
        const credential = await createUserWithEmailAndPassword(
          getClientAuth(),
          email.trim(),
          password,
        );

        // Set the display name before minting the cookie, so the very first
        // session — and the user document created from it — carries the name.
        const trimmed = name?.trim();
        if (trimmed) {
          await updateProfile(credential.user, { displayName: trimmed });
          await credential.user.reload();
        }

        return await complete(credential.user);
      } catch (caught) {
        return toResult(caught);
      } finally {
        setIsPending(false);
      }
    },
    [complete],
  );

  const sendReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isFirebaseClientConfigured()) return NOT_CONFIGURED;
    setIsPending(true);
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
      return { ok: true };
    } catch (caught) {
      // An unknown address must look identical to a known one, or this form
      // becomes a way to test which emails have accounts.
      const code =
        typeof caught === "object" && caught && "code" in caught
          ? String((caught as { code: unknown }).code)
          : "";
      if (code === "auth/user-not-found") return { ok: true };
      return toResult(caught);
    } finally {
      setIsPending(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsPending(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      if (isFirebaseClientConfigured()) {
        await firebaseSignOut(getClientAuth()).catch(() => {});
      }
      setUser(null);
      router.refresh();
      router.push("/");
    } finally {
      setIsPending(false);
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isPending,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendReset,
      signOut,
    }),
    [
      user,
      isPending,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendReset,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return context;
}

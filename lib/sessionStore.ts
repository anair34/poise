import type { Session } from "./types";

/**
 * In-memory session store for the mock analysis path, replaced by Supabase
 * persistence in the next step.
 *
 * Pinned to globalThis because route handlers and server components are
 * separate module instances in dev, and HMR would otherwise reset the map.
 */
const globalStore = globalThis as typeof globalThis & {
  __poiseSessions?: Map<string, Session>;
};

const sessions = (globalStore.__poiseSessions ??= new Map<string, Session>());

export function saveSession(session: Session): void {
  sessions.set(session.id, session);
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

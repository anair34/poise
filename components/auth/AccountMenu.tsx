"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

function initialsFor(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function AccountMenu() {
  const { user, signOut, isPending } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click and on Escape, the two things a custom menu has to
  // handle to behave like a real one.
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // A link, not an inline popup: there is no unsaved work in the nav to
  // preserve, and the full page can offer email sign-in too.
  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-full border border-hairline bg-canvas px-3.5 py-1.5 text-[0.8rem] font-medium text-ink transition-colors duration-200 hover:border-ink/25 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-hairline bg-paper text-[0.72rem] font-semibold text-ink-soft transition-colors duration-200 hover:border-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt=""
            width={32}
            height={32}
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          initialsFor(user.name, user.email)
        )}
        <span className="sr-only">Account</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_16px_40px_-24px_rgba(0,0,0,0.35)]"
        >
          <div className="border-b border-hairline px-3.5 py-3">
            {user.name ? (
              <p className="truncate text-[0.85rem] font-medium text-ink">
                {user.name}
              </p>
            ) : null}
            {user.email ? (
              <p className="truncate text-[0.78rem] text-ink-muted">
                {user.email}
              </p>
            ) : null}
          </div>
          <Link
            href="/progress"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="block px-3.5 py-2.5 text-[0.85rem] text-ink-soft transition-colors duration-150 hover:bg-paper hover:text-ink"
          >
            Progress
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={() => void signOut()}
            className="w-full px-3.5 py-2.5 text-left text-[0.85rem] text-ink-soft transition-colors duration-150 hover:bg-paper hover:text-ink disabled:opacity-60"
          >
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

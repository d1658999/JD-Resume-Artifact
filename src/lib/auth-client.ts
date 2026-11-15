"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { PublicUser } from "@/types/domain";

/** Window event fired whenever the auth session changes (login / register / logout). */
export const AUTH_CHANGED_EVENT = "jd-auth-changed";

export type AuthStatus = "loading" | "ready";

export interface CurrentUserState {
  status: AuthStatus;
  user: PublicUser | null;
  refresh: () => Promise<void>;
  clear: () => void;
}

/** Broadcast that the session changed so every `useCurrentUser` consumer re-fetches. */
export function notifyAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<PublicUser | null> {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user?: PublicUser };
  return payload.user ?? null;
}

/**
 * Client-side session hook. Re-fetches `/api/auth/me` on mount, on every
 * pathname change, on `AUTH_CHANGED_EVENT`, and when the tab regains focus,
 * so layout-level components (Navbar, CTAs) never show a stale auth state.
 */
export function useCurrentUser(): CurrentUserState {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setStatus("ready");
    }
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setStatus("ready");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchCurrentUser(controller.signal)
      .then((nextUser) => {
        setUser(nextUser);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setUser(null);
        setStatus("ready");
      });

    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    function handleChange() {
      void refresh();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleChange);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  return { status, user, refresh, clear };
}

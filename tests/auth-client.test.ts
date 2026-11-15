import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_CHANGED_EVENT,
  fetchCurrentUser,
  notifyAuthChanged,
} from "@/lib/auth-client";
import type { PublicUser } from "@/types/domain";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const USER_FIXTURE: PublicUser = {
  id: "64b7f0c2f1a2b3c4d5e6f7a8",
  email: "member@example.com",
  name: "Member User",
  gender: "male",
  role: "admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  mentor: {
    mentorGender: "female",
    mentorName: "星野 凜 (Rin Hoshino)",
    mentorTitle: "資深職涯導師 Senior Career Mentor",
    avatarUrl: "/avatars/mentor-female.jpg",
    greetingZh: "你好，我是星野 凜。讓我們一起分析這份職缺吧！",
    greetingEn: "Hi, I'm Rin Hoshino. Let's analyze this role together.",
  },
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("notifyAuthChanged", () => {
  let fakeWindow: EventTarget;

  beforeEach(() => {
    fakeWindow = new EventTarget();
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches the auth changed event exactly once", () => {
    const authListener = vi.fn();
    const unrelatedListener = vi.fn();

    fakeWindow.addEventListener(AUTH_CHANGED_EVENT, authListener);
    fakeWindow.addEventListener("jd-unrelated-event", unrelatedListener);

    notifyAuthChanged();

    expect(authListener).toHaveBeenCalledTimes(1);

    const event = authListener.mock.calls[0]?.[0] as Event;
    expect(event).toBeInstanceOf(Event);
    expect(event.type).toBe(AUTH_CHANGED_EVENT);
    expect(unrelatedListener).not.toHaveBeenCalled();
  });

  it("is a no-op when window is unavailable", () => {
    vi.unstubAllGlobals();

    expect(typeof window).toBe("undefined");
    expect(() => notifyAuthChanged()).not.toThrow();
  });
});

describe("fetchCurrentUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current user from a 200 response with a no-store request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user: USER_FIXTURE }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toEqual(USER_FIXTURE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });

  it("forwards an AbortSignal to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ user: USER_FIXTURE }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await fetchCurrentUser(controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("returns null for a 401 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "Not authenticated." }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("returns null when a 200 payload has no user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ stats: { totalUsers: 0 } }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("propagates a rejected request so callers can fall back to signed out", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

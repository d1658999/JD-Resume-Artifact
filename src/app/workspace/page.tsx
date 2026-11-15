"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Home,
  Link2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import ApiKeyPanel from "@/components/ApiKeyPanel";
import MentorGuideBanner from "@/components/MentorGuideBanner";
import WorkspaceStudio from "@/components/WorkspaceStudio";

import type { AiProvider, PublicUser } from "@/types/domain";

const CARD =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100";
const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";
const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: PublicUser };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPublicUser(value: unknown): value is PublicUser {
  if (!isRecord(value) || !isRecord(value.mentor)) {
    return false;
  }

  const mentor = value.mentor;

  return (
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.name === "string" &&
    (value.gender === "male" || value.gender === "female") &&
    (value.role === "user" || value.role === "admin") &&
    typeof value.createdAt === "string" &&
    (mentor.mentorGender === "male" || mentor.mentorGender === "female") &&
    typeof mentor.mentorName === "string" &&
    typeof mentor.mentorTitle === "string" &&
    typeof mentor.avatarUrl === "string" &&
    typeof mentor.greetingZh === "string" &&
    typeof mentor.greetingEn === "string"
  );
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      isRecord(payload) &&
      typeof payload.error === "string" &&
      payload.error.trim() !== ""
    ) {
      return payload.error;
    }
  } catch {
    // The body was not JSON; keep the caller-provided fallback.
  }

  return fallback;
}

function WorkspaceLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8"
    >
      <span className="sr-only">正在載入你的工作區…</span>
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-9 w-full max-w-xl rounded bg-slate-200" />
        <div className="mt-3 h-4 w-3/4 max-w-2xl rounded bg-slate-200/80" />

        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-[136px] w-[136px] shrink-0 rounded-2xl bg-slate-200/80" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-44 rounded bg-slate-200" />
              <div className="h-4 w-64 max-w-full rounded bg-slate-200/80" />
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-4/5 rounded bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-[28rem] rounded-2xl border border-slate-200/80 bg-white" />
          <div className="h-80 rounded-2xl border border-slate-200/80 bg-white" />
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const requestedRef = useRef(false);

  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadUser = useCallback(async (): Promise<void> => {
    setAuthState({ status: "loading" });

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "無法載入你的帳號資料，請稍後再試。",
        );

        if (mountedRef.current) {
          setAuthState({ status: "error", message });
        }
        return;
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        if (mountedRef.current) {
          setAuthState({
            status: "error",
            message: "伺服器回應格式不正確，請重新載入。",
          });
        }
        return;
      }

      const user = isRecord(payload) ? payload.user : undefined;

      if (!isPublicUser(user)) {
        if (mountedRef.current) {
          setAuthState({
            status: "error",
            message: "伺服器沒有回傳完整的使用者資料，請重新載入。",
          });
        }
        return;
      }

      if (mountedRef.current) {
        setAuthState({ status: "ready", user });
      }
    } catch {
      if (mountedRef.current) {
        setAuthState({
          status: "error",
          message: "無法連線到伺服器，請檢查網路連線後再試。",
        });
      }
    }
  }, [router]);

  useEffect(() => {
    if (requestedRef.current) {
      return;
    }

    requestedRef.current = true;
    void loadUser();
  }, [loadUser]);

  if (authState.status === "loading") {
    return (
      <main className="flex-1 bg-[#F6F7FB] pb-20">
        <WorkspaceLoadingSkeleton />
      </main>
    );
  }

  if (authState.status === "error") {
    return (
      <main className="flex-1 bg-[#F6F7FB] pb-20">
        <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <div className={`${CARD} text-center`} role="alert">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 text-balance">
              無法載入工作區
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {authState.message}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadUser()}
                className={PRIMARY_BUTTON}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                重新載入
              </button>
              <Link href="/" className={SECONDARY_BUTTON}>
                <Home className="h-4 w-4" aria-hidden="true" />
                回首頁
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { user } = authState;

  return (
    <main className="flex-1 bg-[#F6F7FB] pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={EYEBROW}>CAREER WORKSPACE</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 text-balance sm:text-4xl">
              {user.name}，今天想攻克哪個職缺？
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`${BADGE} border-indigo-100 bg-indigo-50 text-indigo-700`}
              >
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {user.role === "admin" ? "管理員 Admin" : "會員 Member"}
              </span>
              {activeRecordId !== null ? (
                <span
                  className={`${BADGE} border-emerald-200 bg-emerald-50 text-emerald-700`}
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  作品紀錄已連結
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              貼上職缺連結、匯入履歷，讓 AI
              在同一份作品紀錄中完成技能分析、履歷重寫與面試準備。
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/" className={SECONDARY_BUTTON}>
              <Home className="h-4 w-4" aria-hidden="true" />
              回首頁
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <MentorGuideBanner user={user} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="order-2 min-w-0 lg:order-1">
            <WorkspaceStudio
              provider={provider}
              apiKey={apiKey}
              onRecordChange={setActiveRecordId}
            />
          </div>

          <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-24">
            <ApiKeyPanel
              provider={provider}
              apiKey={apiKey}
              onProviderChange={setProvider}
              onApiKeyChange={setApiKey}
            />
          </div>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"
            aria-hidden="true"
          />
          分析結果會自動儲存到你的作品紀錄，並包含 Vercel Blob 履歷連結。
        </p>
      </div>
    </main>
  );
}

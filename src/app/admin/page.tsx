"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Home,
  LayoutDashboard,
  Loader2,
  LogIn,
  RotateCw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import AdminDashboard from "@/components/AdminDashboard";

import type { PublicUser } from "@/types/domain";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const EYEBROW_CLASS =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type PageState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "error"; message: string }
  | { status: "authenticated"; user: PublicUser };

interface AuthPayload {
  user: PublicUser;
}

type CurrentUserResult =
  | { kind: "ok"; user: PublicUser }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPublicUser(value: unknown): value is PublicUser {
  if (!isPlainObject(value)) {
    return false;
  }

  const mentor = value.mentor;

  return (
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.name === "string" &&
    (value.gender === "male" || value.gender === "female") &&
    (value.role === "user" || value.role === "admin") &&
    isPlainObject(mentor) &&
    (mentor.mentorGender === "male" || mentor.mentorGender === "female") &&
    typeof mentor.mentorName === "string" &&
    typeof mentor.mentorTitle === "string" &&
    typeof mentor.avatarUrl === "string" &&
    typeof mentor.greetingZh === "string" &&
    typeof mentor.greetingEn === "string" &&
    typeof value.createdAt === "string"
  );
}

function isAuthPayload(value: unknown): value is AuthPayload {
  return isPlainObject(value) && isPublicUser(value.user);
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);

  if (
    isPlainObject(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
  ) {
    return payload.error;
  }

  return fallback;
}

async function requestCurrentUser(
  signal: AbortSignal,
): Promise<CurrentUserResult> {
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    });

    if (response.status === 401) {
      return { kind: "unauthenticated" };
    }

    if (!response.ok) {
      return {
        kind: "error",
        message: await readApiError(
          response,
          "無法確認登入狀態，請稍後再試。",
        ),
      };
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!isAuthPayload(payload)) {
      return {
        kind: "error",
        message: "登入資料格式不正確，請重新整理頁面。",
      };
    }

    return { kind: "ok", user: payload.user };
  } catch {
    return {
      kind: "error",
      message: "無法連線至伺服器，請檢查網路後重試。",
    };
  }
}

function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">正在確認登入狀態與管理員權限…</span>
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-44 rounded-full bg-slate-200/80" />
        <div className="h-9 w-72 max-w-full rounded-xl bg-slate-200/80" />
        <div className="h-4 w-full max-w-xl rounded-full bg-slate-200/70" />
        <div className="h-4 w-2/3 max-w-md rounded-full bg-slate-200/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`${CARD_CLASS} animate-pulse`}
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded-full bg-slate-100" />
                <div className="h-3 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-11 w-11 rounded-xl bg-slate-100" />
            </div>
            <div className="mt-5 h-9 w-20 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
      <div className={`${CARD_CLASS} animate-pulse`} aria-hidden="true">
        <div className="h-28 w-full rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function RedirectingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]"
      >
        <Loader2
          className="h-4 w-4 animate-spin text-indigo-600"
          aria-hidden="true"
        />
        <span>登入狀態已失效，正在前往登入頁…</span>
      </div>
    </div>
  );
}

function AuthErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div role="alert" className={`${CARD_CLASS} text-center`}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className={`mt-5 ${EYEBROW_CLASS}`}>AUTH CHECK FAILED</p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-900">
          無法確認登入狀態
        </h1>
        <p className="mt-3 break-words text-sm leading-6 text-slate-600">
          {message}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className={PRIMARY_BUTTON_CLASS}
            title="重新確認登入狀態"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            重新嘗試
          </button>
          <Link href="/login" className={SECONDARY_BUTTON_CLASS}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            前往登入
          </Link>
        </div>
      </div>
    </div>
  );
}

function AccessDeniedCard({ email }: { email: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className={`${CARD_CLASS} text-center`}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className={`mt-5 ${EYEBROW_CLASS}`}>
          ACCESS RESTRICTED · 權限不足
        </p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900">
          僅限管理員存取
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          這個頁面僅開放給具備管理員角色的帳號。你目前以{" "}
          <span className="break-all font-semibold text-slate-900">
            {email}
          </span>{" "}
          登入，若需要管理使用者與作品紀錄，請聯絡平台主要管理員開通權限。
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          This area is restricted to administrator accounts.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/workspace"
            className={PRIMARY_BUTTON_CLASS}
            title="前往工作台"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            前往工作台
          </Link>
          <Link href="/" className={SECONDARY_BUTTON_CLASS} title="回到首頁">
            <Home className="h-4 w-4" aria-hidden="true" />
            回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminPageHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className={EYEBROW_CLASS}>ADMIN · 管理後台</p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          管理員專區
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-relaxed">
          管理平台使用者與所有 AI 作品紀錄，包含 JD 分析、履歷健檢、面試題組與
          Vercel Blob 履歷連結。
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Admin workspace for users, roles, and every generated artifact.
        </p>
      </div>
      <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        前往工作台
      </Link>
    </header>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const result = await requestCurrentUser(controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      if (result.kind === "ok") {
        setState({ status: "authenticated", user: result.user });
        return;
      }

      if (result.kind === "unauthenticated") {
        setState({ status: "redirecting" });
        router.replace("/login");
        return;
      }

      setState({ status: "error", message: result.message });
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [reloadKey, router]);

  function handleRetry() {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="flex-1 bg-[#F6F7FB]">
      <main className="mx-auto w-full max-w-[1680px] 2xl:max-w-[1760px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-12">
        {state.status === "loading" ? <PageSkeleton /> : null}
        {state.status === "redirecting" ? <RedirectingState /> : null}
        {state.status === "error" ? (
          <AuthErrorCard message={state.message} onRetry={handleRetry} />
        ) : null}
        {state.status === "authenticated" ? (
          state.user.role === "admin" ? (
            <div className="space-y-8">
              <AdminPageHeader />
              <AdminDashboard user={state.user} />
            </div>
          ) : (
            <AccessDeniedCard email={state.user.email} />
          )
        ) : null}
      </main>
    </div>
  );
}

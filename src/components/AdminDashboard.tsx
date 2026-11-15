"use client";

import Link from "next/link";
import {
  AlertCircle,
  CloudUpload,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Loader2,
  LogIn,
  RotateCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AiProvider,
  ArtifactRecordDTO,
  PublicUser,
  ResumeSourceType,
  UserRole,
} from "@/types/domain";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const EYEBROW_CLASS =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const DANGER_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const TABLE_WRAPPER_CLASS =
  "mt-5 overflow-x-auto rounded-2xl border border-slate-200/80";
const TABLE_HEADER_CELL_CLASS =
  "whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";
const TABLE_CELL_CLASS = "px-5 py-4 align-middle";

const NUMBER_FORMATTER = new Intl.NumberFormat("zh-TW");
const DATE_FORMATTER = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama",
};

const PROVIDER_BADGE_CLASS: Record<AiProvider, string> = {
  openai: "border-emerald-200 bg-emerald-50 text-emerald-700",
  gemini: "border-sky-200 bg-sky-50 text-sky-700",
  ollama: "border-slate-200 bg-slate-100 text-slate-600",
};

const SOURCE_LABEL: Record<ResumeSourceType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  google_docs: "Google Docs",
  notion: "Notion",
};

type KpiTone = "indigo" | "emerald" | "amber" | "rose";

const KPI_TONE_CLASS: Record<KpiTone, string> = {
  indigo: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
};

interface AdminOverviewStats {
  totalUsers: number;
  totalRecords: number;
  totalResumesWithBlob: number;
}

interface AdminOverviewData {
  users: PublicUser[];
  records: ArtifactRecordDTO[];
  stats: AdminOverviewStats;
}

type OverviewLoadResult =
  | { kind: "success"; data: AdminOverviewData }
  | { kind: "forbidden" }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

type AccessIssue = "forbidden" | "unauthenticated";

type FilterTab = "all" | "users" | "records";

type PendingActionType = "role" | "delete-user" | "delete-record";

interface PendingAction {
  type: PendingActionType;
  id: string;
}

interface AdminDashboardProps {
  user: PublicUser;
}

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

function isAiProvider(value: unknown): value is AiProvider {
  return value === "openai" || value === "gemini" || value === "ollama";
}

function isResumeSourceType(value: unknown): value is ResumeSourceType {
  return (
    value === "pdf" ||
    value === "docx" ||
    value === "google_docs" ||
    value === "notion"
  );
}

function isArtifactRecord(value: unknown): value is ArtifactRecordDTO {
  if (!isPlainObject(value)) {
    return false;
  }

  const resumeReview = value.resumeReview;

  return (
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.userEmail === "string" &&
    typeof value.jdUrl === "string" &&
    typeof value.jdTitle === "string" &&
    isAiProvider(value.aiProvider) &&
    typeof value.aiModel === "string" &&
    (value.resumeSourceType === null ||
      isResumeSourceType(value.resumeSourceType)) &&
    (value.resumeFileName === null ||
      typeof value.resumeFileName === "string") &&
    (value.resumeBlobUrl === null ||
      typeof value.resumeBlobUrl === "string") &&
    (value.resumeSourceUrl === null ||
      typeof value.resumeSourceUrl === "string") &&
    (value.jdAnalysis === null || isPlainObject(value.jdAnalysis)) &&
    (resumeReview === null ||
      (isPlainObject(resumeReview) &&
        typeof resumeReview.overallScore === "number")) &&
    (value.interviewQuestions === null ||
      isPlainObject(value.interviewQuestions)) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isAdminOverviewData(value: unknown): value is AdminOverviewData {
  if (!isPlainObject(value)) {
    return false;
  }

  const { users, records, stats } = value;

  if (!isPlainObject(stats)) {
    return false;
  }

  return (
    Array.isArray(users) &&
    users.every(isPublicUser) &&
    Array.isArray(records) &&
    records.every(isArtifactRecord) &&
    typeof stats.totalUsers === "number" &&
    typeof stats.totalRecords === "number" &&
    typeof stats.totalResumesWithBlob === "number"
  );
}

function localizeAdminErrorMessage(status: number, message: string): string {
  if (/admin access required|not authenticated/i.test(message)) {
    return status === 403 ? "僅限管理員存取。" : "請先登入後再繼續操作。";
  }

  if (/primary admin/i.test(message)) {
    return "主要管理員帳號不可被降級或刪除。";
  }

  if (status === 403) {
    return "你沒有執行此操作的權限。";
  }

  if (status === 404) {
    return "找不到指定的資料，請重新整理後再試。";
  }

  if (status >= 500) {
    return "伺服器暫時無法處理請求，請稍後再試。";
  }

  return message;
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
    return localizeAdminErrorMessage(response.status, payload.error.trim());
  }

  return fallback;
}

async function requestOverview(): Promise<OverviewLoadResult> {
  try {
    const response = await fetch("/api/admin/overview", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });

    if (response.status === 401) {
      return { kind: "unauthenticated" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (!response.ok) {
      return {
        kind: "error",
        message: await readApiError(
          response,
          "無法載入平台總覽，請稍後再試。",
        ),
      };
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!isAdminOverviewData(payload)) {
      return {
        kind: "error",
        message: "平台總覽資料格式不正確，請重新整理頁面。",
      };
    }

    return { kind: "success", data: payload };
  } catch {
    return {
      kind: "error",
      message: "無法連線至伺服器，請檢查網路後再試。",
    };
  }
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? "—" : DATE_FORMATTER.format(parsed);
}

function formatDateTime(value: string): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : DATE_TIME_FORMATTER.format(parsed);
}

function formatUpdatedAt(value: string): string {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : UPDATED_AT_FORMATTER.format(parsed);
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? score.toString() : score.toFixed(1);
}

function getSafeHttpUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function getScoreBadgeClass(score: number): string {
  if (score >= 80) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (score >= 60) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getDisplayName(target: PublicUser): string {
  return target.name.trim() || target.email;
}

function getInitial(target: PublicUser): string {
  const source = getDisplayName(target).trim();
  const firstCharacter = Array.from(source)[0];

  return firstCharacter ? firstCharacter.toUpperCase() : "?";
}

function getRoleToggleMeta(target: PublicUser): {
  nextRole: UserRole;
  buttonLabel: string;
  nextRoleLabel: string;
} {
  if (target.role === "admin") {
    return {
      nextRole: "user",
      buttonLabel: "設為一般使用者",
      nextRoleLabel: "一般使用者",
    };
  }

  return {
    nextRole: "admin",
    buttonLabel: "設為管理員",
    nextRoleLabel: "管理員",
  };
}

function KpiCard({
  icon: Icon,
  labelZh,
  labelEn,
  value,
  tone,
}: {
  icon: LucideIcon;
  labelZh: string;
  labelEn: string;
  value: number;
  tone: KpiTone;
}) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{labelZh}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {labelEn}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${KPI_TONE_CLASS[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {NUMBER_FORMATTER.format(value)}
      </p>
    </div>
  );
}

function TableHeader({
  zh,
  en,
  align = "left",
  className = "",
}: {
  zh: string;
  en: string;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`${TABLE_HEADER_CELL_CLASS} ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      <span className="block">{zh}</span>
      <span className="mt-0.5 block text-[10px] font-medium tracking-[0.12em] text-slate-400">
        {en}
      </span>
    </th>
  );
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      <AlertCircle
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="關閉錯誤訊息"
        title="關閉錯誤訊息"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function AccessStateCard({
  issue,
  adminEmail,
  retryPending,
  onRetry,
}: {
  issue: AccessIssue;
  adminEmail: string;
  retryPending: boolean;
  onRetry: () => void;
}) {
  const isForbidden = issue === "forbidden";

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col items-center text-center">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            isForbidden
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
              : "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
          }`}
        >
          {isForbidden ? (
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          ) : (
            <LogIn className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <p className={`mt-5 ${EYEBROW_CLASS}`}>
          {isForbidden ? "ACCESS DENIED" : "SESSION EXPIRED"}
        </p>
        <h3 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-900">
          {isForbidden ? "無法存取管理資料" : "登入狀態已失效"}
        </h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          {isForbidden
            ? "伺服器回覆此帳號沒有管理員權限。若權限剛被調整，請重新確認；若仍需要管理平台，請聯絡主要管理員。"
            : "目前的登入狀態已失效，或帳號已不存在。請重新登入後再存取管理後台。"}
        </p>
        <p className="mt-1 max-w-xl break-all text-xs text-slate-500">
          目前登入：{adminEmail}
        </p>
        <div className="mt-5 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          {isForbidden ? (
            <>
              <button
                type="button"
                onClick={onRetry}
                disabled={retryPending}
                className={PRIMARY_BUTTON_CLASS}
                title="重新確認管理員權限"
              >
                {retryPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                )}
                {retryPending ? "確認中…" : "重新確認權限"}
              </button>
              <Link href="/workspace" className={SECONDARY_BUTTON_CLASS}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                前往工作台
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={PRIMARY_BUTTON_CLASS}>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                前往登入
              </Link>
              <Link href="/" className={SECONDARY_BUTTON_CLASS}>
                <Home className="h-4 w-4" aria-hidden="true" />
                回首頁
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className={CARD_CLASS}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className={`mt-5 ${EYEBROW_CLASS}`}>LOAD ERROR</p>
        <h3 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-900">
          無法載入平台總覽
        </h3>
        <p className="mt-3 max-w-xl break-words text-sm leading-6 text-slate-600">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={`${PRIMARY_BUTTON_CLASS} mt-5`}
          title="重新載入平台總覽"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          重新載入
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-1 text-base font-semibold text-slate-900">{title}</p>
      <p className="max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">正在載入平台總覽資料…</span>
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
        <div className="h-10 w-full rounded-xl bg-slate-100" />
      </div>
      <div className={`${CARD_CLASS} animate-pulse`} aria-hidden="true">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-slate-100" />
            <div className="h-5 w-40 rounded-full bg-slate-100" />
          </div>
          <div className="h-4 w-32 rounded-full bg-slate-100" />
        </div>
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-12 w-full rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  userCount,
  recordCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  userCount: number;
  recordCount: number;
}) {
  const tabs: { id: FilterTab; label: string; count: number; title: string }[] =
    [
      {
        id: "all",
        label: "全部",
        count: userCount + recordCount,
        title: "顯示全部使用者與作品紀錄",
      },
      {
        id: "users",
        label: "使用者",
        count: userCount,
        title: "只顯示使用者",
      },
      {
        id: "records",
        label: "作品紀錄",
        count: recordCount,
        title: "只顯示作品紀錄",
      },
    ];

  return (
    <section aria-label="搜尋與篩選" className={CARD_CLASS}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="admin-search"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            搜尋{" "}
            <span className="font-normal text-slate-400">
              Search users and artifacts
            </span>
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="admin-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="輸入姓名、電子郵件或職缺名稱"
              aria-describedby="admin-search-hint"
              className={`${INPUT_CLASS} pl-10 pr-11`}
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="清除搜尋條件"
                title="清除搜尋條件"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p id="admin-search-hint" className="mt-1.5 text-xs text-slate-500">
            以姓名、電子郵件、職缺名稱搜尋，英文字母不分大小寫。
          </p>
        </div>

        <div className="lg:shrink-0">
          <p className="mb-1.5 text-sm font-medium text-slate-700">
            顯示範圍{" "}
            <span className="font-normal text-slate-400">View</span>
          </p>
          <div
            role="group"
            aria-label="篩選資料類型"
            className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-pressed={isActive}
                  title={tab.title}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/70 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function UsersTable({
  users,
  totalCount,
  currentUserId,
  pendingAction,
  controlsDisabled,
  hasQuery,
  onToggleRole,
  onDeleteUser,
}: {
  users: PublicUser[];
  totalCount: number;
  currentUserId: string;
  pendingAction: PendingAction | null;
  controlsDisabled: boolean;
  hasQuery: boolean;
  onToggleRole: (target: PublicUser) => void;
  onDeleteUser: (target: PublicUser) => void;
}) {
  return (
    <section aria-labelledby="admin-users-title" className={CARD_CLASS}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={EYEBROW_CLASS}>USERS · 使用者</p>
          <h3
            id="admin-users-title"
            className="mt-1 text-balance text-xl font-semibold tracking-tight text-slate-900"
          >
            使用者管理
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          顯示{" "}
          <span className="font-semibold text-slate-900">{users.length}</span> /{" "}
          {totalCount} 位使用者
        </p>
      </div>

      <div className={TABLE_WRAPPER_CLASS}>
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              hasQuery ? "找不到符合搜尋的使用者" : "目前沒有使用者"
            }
            description={
              hasQuery
                ? "請調整搜尋關鍵字，或切換至其他資料類型。"
                : "平台目前尚無註冊使用者，新帳號註冊後會顯示在這裡。"
            }
            hint={
              hasQuery
                ? "No users match your search."
                : "No users have registered yet."
            }
          />
        ) : (
          <table className="w-full min-w-[980px] divide-y divide-slate-200/80 text-left text-sm">
            <caption className="sr-only">
              平台使用者清單，可檢視角色、註冊時間並變更角色或刪除使用者
            </caption>
            <thead className="bg-slate-50/80">
              <tr>
                <TableHeader
                  zh="使用者"
                  en="User"
                  className="min-w-[260px]"
                />
                <TableHeader zh="性別" en="Gender" />
                <TableHeader zh="角色" en="Role" />
                <TableHeader zh="註冊時間" en="Registered" />
                <TableHeader zh="操作" en="Actions" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {users.map((target) => {
                const rowPending = pendingAction?.id === target.id;
                const rolePending =
                  rowPending && pendingAction?.type === "role";
                const deletePending =
                  rowPending && pendingAction?.type === "delete-user";
                const { nextRole, buttonLabel, nextRoleLabel } =
                  getRoleToggleMeta(target);
                const isSelf = target.id === currentUserId;
                const displayName = getDisplayName(target);

                return (
                  <tr
                    key={target.id}
                    aria-busy={rowPending}
                    className={`transition ${
                      rowPending ? "bg-indigo-50/40" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100"
                        >
                          {getInitial(target)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="max-w-[200px] truncate font-semibold text-slate-900"
                              title={displayName}
                            >
                              {displayName}
                            </p>
                            {isSelf ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700 ring-1 ring-indigo-100">
                                你
                              </span>
                            ) : null}
                          </div>
                          <a
                            href={`mailto:${target.email}`}
                            title={`寄送電子郵件給 ${target.email}`}
                            className="mt-0.5 block max-w-[220px] truncate text-xs text-slate-500 underline-offset-4 transition hover:text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          >
                            {target.email}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} whitespace-nowrap text-slate-600`}
                    >
                      {target.gender === "male" ? "男" : "女"}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} whitespace-nowrap`}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          target.role === "admin"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {target.role === "admin" ? (
                          <ShieldCheck
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : null}
                        {target.role === "admin" ? "管理員" : "一般使用者"}
                      </span>
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} whitespace-nowrap text-slate-600`}
                    >
                      <time dateTime={target.createdAt}>
                        {formatDate(target.createdAt)}
                      </time>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleRole(target)}
                          disabled={controlsDisabled}
                          title={`將 ${displayName}（${target.email}）的角色變更為${nextRoleLabel}`}
                          aria-label={`將 ${displayName} 的角色變更為${nextRoleLabel}`}
                          className={SECONDARY_BUTTON_CLASS}
                        >
                          {rolePending ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : nextRole === "admin" ? (
                            <ShieldCheck
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <ShieldOff
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                          {rolePending ? "更新中…" : buttonLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(target)}
                          disabled={controlsDisabled}
                          title={`刪除使用者 ${displayName}（${target.email}）`}
                          aria-label={`刪除使用者 ${displayName}`}
                          className={DANGER_BUTTON_CLASS}
                        >
                          {deletePending ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          {deletePending ? "刪除中…" : "刪除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RecordsTable({
  records,
  totalCount,
  pendingAction,
  controlsDisabled,
  hasQuery,
  onDeleteRecord,
}: {
  records: ArtifactRecordDTO[];
  totalCount: number;
  pendingAction: PendingAction | null;
  controlsDisabled: boolean;
  hasQuery: boolean;
  onDeleteRecord: (record: ArtifactRecordDTO) => void;
}) {
  return (
    <section aria-labelledby="admin-records-title" className={CARD_CLASS}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={EYEBROW_CLASS}>ARTIFACTS · 作品紀錄</p>
          <h3
            id="admin-records-title"
            className="mt-1 text-balance text-xl font-semibold tracking-tight text-slate-900"
          >
            AI 作品紀錄
          </h3>
        </div>
        <p className="text-sm text-slate-500">
          顯示{" "}
          <span className="font-semibold text-slate-900">{records.length}</span>{" "}
          / {totalCount} 筆作品紀錄
        </p>
      </div>

      <div className={TABLE_WRAPPER_CLASS}>
        {records.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              hasQuery ? "找不到符合搜尋的作品紀錄" : "目前沒有作品紀錄"
            }
            description={
              hasQuery
                ? "請調整搜尋關鍵字，或切換至其他資料類型。"
                : "使用者完成 JD 分析、履歷健檢或面試題組後，紀錄會顯示在這裡。"
            }
            hint={
              hasQuery
                ? "No artifacts match your search."
                : "No artifacts have been generated yet."
            }
          />
        ) : (
          <table className="w-full min-w-[1120px] divide-y divide-slate-200/80 text-left text-sm">
            <caption className="sr-only">
              所有 AI 作品紀錄，包含職缺連結、使用者、模型、履歷分數與履歷來源
            </caption>
            <thead className="bg-slate-50/80">
              <tr>
                <TableHeader
                  zh="職缺"
                  en="Job description"
                  className="min-w-[260px]"
                />
                <TableHeader zh="使用者" en="User" />
                <TableHeader zh="AI 模型" en="Model" />
                <TableHeader zh="履歷分數" en="Resume score" />
                <TableHeader zh="履歷來源" en="Resume source" />
                <TableHeader zh="建立時間" en="Created" />
                <TableHeader zh="操作" en="Actions" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {records.map((record) => {
                const recordPending = pendingAction?.id === record.id;
                const deletePending =
                  recordPending && pendingAction?.type === "delete-record";
                const jdHref = getSafeHttpUrl(record.jdUrl);
                const blobHref = getSafeHttpUrl(record.resumeBlobUrl);
                const sourceHref = getSafeHttpUrl(record.resumeSourceUrl);
                const hasResumeInfo = Boolean(
                  record.resumeSourceType ||
                    blobHref ||
                    sourceHref ||
                    record.resumeFileName,
                );
                const score = record.resumeReview?.overallScore ?? null;

                return (
                  <tr
                    key={record.id}
                    aria-busy={recordPending}
                    className={`transition ${
                      recordPending
                        ? "bg-indigo-50/40"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex items-start gap-2">
                        <p
                          className="max-w-[250px] truncate font-semibold text-slate-900"
                          title={record.jdTitle}
                        >
                          {record.jdTitle || "未命名職缺"}
                        </p>
                        {jdHref ? (
                          <a
                            href={jdHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="在新分頁開啟職缺頁面"
                            aria-label={`在新分頁開啟職缺頁面：${record.jdTitle}`}
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          >
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <p
                        className="max-w-[200px] truncate text-slate-600"
                        title={record.userEmail}
                      >
                        {record.userEmail}
                      </p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${PROVIDER_BADGE_CLASS[record.aiProvider]}`}
                        >
                          {PROVIDER_LABEL[record.aiProvider]}
                        </span>
                        <span
                          className="max-w-[180px] truncate text-xs text-slate-500"
                          title={record.aiModel}
                        >
                          {record.aiModel}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} whitespace-nowrap`}
                    >
                      {score === null ? (
                        <span
                          className="text-slate-400"
                          aria-label="尚未產生履歷分數"
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 font-semibold ${getScoreBadgeClass(score)}`}
                          title={`履歷整體分數 ${formatScore(score)} / 100`}
                        >
                          <span className="text-sm tabular-nums">
                            {formatScore(score)}
                          </span>
                          <span className="text-[10px] font-medium opacity-70">
                            / 100
                          </span>
                        </span>
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {hasResumeInfo ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {record.resumeSourceType ? (
                              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {SOURCE_LABEL[record.resumeSourceType]}
                              </span>
                            ) : null}
                            {blobHref ? (
                              <a
                                href={blobHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="在新分頁開啟 Vercel Blob 履歷"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 underline-offset-4 transition hover:text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                              >
                                Vercel Blob
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : null}
                            {!blobHref && sourceHref ? (
                              <a
                                href={sourceHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="在新分頁開啟履歷來源文件"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 underline-offset-4 transition hover:text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                              >
                                來源文件
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : null}
                          </div>
                          {record.resumeFileName ? (
                            <p
                              className="max-w-[230px] truncate text-xs text-slate-500"
                              title={record.resumeFileName}
                            >
                              {record.resumeFileName}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span
                          className="text-slate-400"
                          aria-label="沒有履歷資料"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS} whitespace-nowrap text-slate-600`}
                    >
                      <time dateTime={record.createdAt}>
                        {formatDateTime(record.createdAt)}
                      </time>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} whitespace-nowrap`}>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(record)}
                          disabled={controlsDisabled}
                          title={`刪除作品紀錄：${record.jdTitle}`}
                          aria-label={`刪除作品紀錄：${record.jdTitle}`}
                          className={DANGER_BUTTON_CLASS}
                        >
                          {deletePending ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          {deletePending ? "刪除中…" : "刪除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessIssue, setAccessIssue] = useState<AccessIssue | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const mutationLockRef = useRef(false);

  const applyOverviewResult = useCallback((result: OverviewLoadResult) => {
    if (result.kind === "success") {
      setOverview(result.data);
      setAccessIssue(null);
      setErrorMessage(null);
      setLastUpdatedAt(new Date().toISOString());
      return;
    }

    if (result.kind === "forbidden") {
      setOverview(null);
      setAccessIssue("forbidden");
      setErrorMessage(null);
      return;
    }

    if (result.kind === "unauthenticated") {
      setOverview(null);
      setAccessIssue("unauthenticated");
      setErrorMessage(null);
      return;
    }

    setAccessIssue(null);
    setErrorMessage(result.message);
  }, []);

  const loadOverview = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await requestOverview();

    applyOverviewResult(result);
    setIsLoading(false);

    return result.kind === "success";
  }, [applyOverviewResult]);

  useEffect(() => {
    let active = true;

    async function loadInitialOverview() {
      const result = await requestOverview();

      if (!active) {
        return;
      }

      applyOverviewResult(result);
      setIsLoading(false);
    }

    void loadInitialOverview();

    return () => {
      active = false;
    };
  }, [applyOverviewResult]);

  const adminCount = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return overview.users.filter((target) => target.role === "admin").length;
  }, [overview]);

  const filteredUsers = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return overview.users;
    }

    return overview.users.filter(
      (target) =>
        target.name.toLowerCase().includes(normalizedQuery) ||
        target.email.toLowerCase().includes(normalizedQuery),
    );
  }, [overview, query]);

  const filteredRecords = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return overview.records;
    }

    return overview.records.filter(
      (record) =>
        record.jdTitle.toLowerCase().includes(normalizedQuery) ||
        record.userEmail.toLowerCase().includes(normalizedQuery),
    );
  }, [overview, query]);

  async function runMutation(
    action: PendingAction,
    requestInit: RequestInit,
    fallbackMessage: string,
  ): Promise<void> {
    if (mutationLockRef.current) {
      return;
    }

    mutationLockRef.current = true;
    setPendingAction(action);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/overview", {
        ...requestInit,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        setErrorMessage(await readApiError(response, fallbackMessage));
        return;
      }

      await loadOverview();
    } catch {
      setErrorMessage("無法連線至伺服器，操作未完成，請重試。");
    } finally {
      mutationLockRef.current = false;
      setPendingAction(null);
    }
  }

  function handleReload() {
    if (isLoading || mutationLockRef.current) {
      return;
    }

    void loadOverview();
  }

  function handleToggleRole(target: PublicUser) {
    if (mutationLockRef.current) {
      return;
    }

    const { nextRole, nextRoleLabel } = getRoleToggleMeta(target);
    const displayName = getDisplayName(target);
    const selfNote =
      target.id === user.id ? "（目前登入帳號）" : "";

    const confirmed = window.confirm(
      `確定要將「${displayName}」（${target.email}）${selfNote} 的角色變更為${nextRoleLabel}嗎？`,
    );

    if (!confirmed) {
      return;
    }

    void runMutation(
      { type: "role", id: target.id },
      {
        method: "PATCH",
        body: JSON.stringify({ userId: target.id, role: nextRole }),
      },
      "無法更新使用者角色，請稍後再試。",
    );
  }

  function handleDeleteUser(target: PublicUser) {
    if (mutationLockRef.current) {
      return;
    }

    const displayName = getDisplayName(target);
    const selfNote =
      target.id === user.id
        ? "\n\n注意：你正在刪除目前登入的管理員帳號，完成後將無法再存取管理後台。"
        : "";

    const confirmed = window.confirm(
      `確定要刪除使用者「${displayName}」（${target.email}）嗎？\n此操作無法復原，該使用者的所有作品紀錄也會一併刪除。${selfNote}`,
    );

    if (!confirmed) {
      return;
    }

    void runMutation(
      { type: "delete-user", id: target.id },
      {
        method: "DELETE",
        body: JSON.stringify({ targetType: "user", id: target.id }),
      },
      "無法刪除使用者，請稍後再試。",
    );
  }

  function handleDeleteRecord(record: ArtifactRecordDTO) {
    if (mutationLockRef.current) {
      return;
    }

    const confirmed = window.confirm(
      `確定要刪除作品紀錄「${record.jdTitle}」嗎？\n此操作無法復原。`,
    );

    if (!confirmed) {
      return;
    }

    void runMutation(
      { type: "delete-record", id: record.id },
      {
        method: "DELETE",
        body: JSON.stringify({ targetType: "record", id: record.id }),
      },
      "無法刪除作品紀錄，請稍後再試。",
    );
  }

  const controlsDisabled = isLoading || pendingAction !== null;
  const hasQuery = query.trim().length > 0;

  return (
    <section aria-labelledby="admin-dashboard-title" className="space-y-6">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className={EYEBROW_CLASS}>ADMIN CONSOLE · 管理後台</p>
          <h2
            id="admin-dashboard-title"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            平台總覽與資料管理
          </h2>
          <p className="mt-3 break-all text-sm leading-6 text-slate-600">
            目前登入：
            <span className="font-semibold text-slate-900">{user.email}</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            管理所有使用者、角色與 AI 作品紀錄。
            <span className="text-slate-400">
              {" "}
              Signed in as administrator.
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleReload}
            disabled={controlsDisabled}
            title="重新整理平台總覽資料"
            className={SECONDARY_BUTTON_CLASS}
          >
            <RotateCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isLoading ? "更新中…" : "重新整理"}
          </button>
          <p className="text-xs text-slate-500">
            最後更新：
            {lastUpdatedAt ? (
              <time dateTime={lastUpdatedAt}>
                {formatUpdatedAt(lastUpdatedAt)}
              </time>
            ) : (
              "尚未更新"
            )}
          </p>
        </div>
      </header>

      {accessIssue ? (
        <AccessStateCard
          issue={accessIssue}
          adminEmail={user.email}
          retryPending={isLoading}
          onRetry={handleReload}
        />
      ) : !overview ? (
        isLoading ? (
          <DashboardSkeleton />
        ) : (
          <LoadErrorCard
            message={
              errorMessage ?? "目前無法載入平台總覽資料，請稍後再試。"
            }
            onRetry={handleReload}
          />
        )
      ) : (
        <div
          className="space-y-6"
          aria-busy={isLoading || pendingAction !== null}
        >
          {errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Users}
              labelZh="總使用者"
              labelEn="Total users"
              value={overview.stats.totalUsers}
              tone="indigo"
            />
            <KpiCard
              icon={FileText}
              labelZh="總作品紀錄"
              labelEn="Total artifacts"
              value={overview.stats.totalRecords}
              tone="emerald"
            />
            <KpiCard
              icon={CloudUpload}
              labelZh="含 Vercel Blob 履歷"
              labelEn="Resumes with Blob"
              value={overview.stats.totalResumesWithBlob}
              tone="amber"
            />
            <KpiCard
              icon={ShieldCheck}
              labelZh="管理員"
              labelEn="Administrators"
              value={adminCount}
              tone="rose"
            />
          </div>

          <FilterBar
            query={query}
            onQueryChange={setQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            userCount={overview.users.length}
            recordCount={overview.records.length}
          />

          {activeTab !== "records" ? (
            <UsersTable
              users={filteredUsers}
              totalCount={overview.users.length}
              currentUserId={user.id}
              pendingAction={pendingAction}
              controlsDisabled={controlsDisabled}
              hasQuery={hasQuery}
              onToggleRole={handleToggleRole}
              onDeleteUser={handleDeleteUser}
            />
          ) : null}

          {activeTab !== "users" ? (
            <RecordsTable
              records={filteredRecords}
              totalCount={overview.records.length}
              pendingAction={pendingAction}
              controlsDisabled={controlsDisabled}
              hasQuery={hasQuery}
              onDeleteRecord={handleDeleteRecord}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

"use client";

import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  FileUp,
  Gauge,
  Info,
  KeyRound,
  Link2,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from "lucide-react";

import type {
  AiProvider,
  ArtifactRecordDTO,
  BilingualList,
  InterviewQuestion,
  JdSkillAnalysis,
  ResumeModificationItem,
  ResumeReviewResult,
  ResumeScoreItem,
  ResumeSourceType,
} from "@/types/domain";

const CARD =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100";
const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const RESUME_PREVIEW_LENGTH = 800;

type StudioTab = "jd" | "resume" | "interview";
type Locale = "zh" | "en";
type SourceMode = "file" | "link";
type PublicLinkSource = "google_docs" | "notion";

const TABS: readonly { id: StudioTab; number: string; label: string }[] = [
  { id: "jd", number: "01", label: "職缺技能分析" },
  { id: "resume", number: "02", label: "履歷評分與重寫" },
  { id: "interview", number: "03", label: "模擬面試 / 筆試" },
];

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama Cloud",
};

const RESUME_SOURCE_LABEL: Record<ResumeSourceType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  google_docs: "Google Docs",
  notion: "Notion",
};

const QUESTION_TYPE_META: Record<
  InterviewQuestion["type"],
  { zh: string; en: string }
> = {
  technical: { zh: "技術", en: "technical" },
  behavioral: { zh: "行為", en: "behavioral" },
  system_design: { zh: "系統設計", en: "system_design" },
  written_test: { zh: "筆試", en: "written_test" },
};

const DIFFICULTY_META: Record<
  InterviewQuestion["difficulty"],
  { zh: string; en: string; className: string }
> = {
  easy: {
    zh: "簡單",
    en: "easy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  medium: {
    zh: "中等",
    en: "medium",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  hard: {
    zh: "困難",
    en: "hard",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

interface ResumeUploadResult {
  extractedText: string;
  blobUrl: string;
  fileName: string;
  sourceType: ResumeSourceType;
  sourceUrl: string | null;
}

interface AnalyzeResponse {
  record?: ArtifactRecordDTO;
}

interface RecordsResponse {
  records?: ArtifactRecordDTO[];
}

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

interface WorkspaceStudioProps {
  provider: AiProvider;
  apiKey: string;
  onRecordChange: (recordId: string | null) => void;
}

interface RecordsPanelProps {
  records: ArtifactRecordDTO[];
  loading: boolean;
  error: string | null;
  activeRecordId: string | null;
  deletingId: string | null;
  onSelect: (record: ArtifactRecordDTO) => void;
  onDelete: (record: ArtifactRecordDTO) => void;
  onReload: () => void;
}

function formatRecordDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "日期不明";
  }

  return dateFormatter.format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPublicLinkSource(value: string): value is PublicLinkSource {
  return value === "google_docs" || value === "notion";
}

function buildRequestBody(
  entries: Record<string, string | null | undefined>,
): Record<string, string> {
  const body: Record<string, string> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed === "") {
      continue;
    }

    body[key] = trimmed;
  }

  return body;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (payload !== null && typeof payload === "object") {
      const message = (payload as { error?: unknown }).error;

      if (typeof message === "string" && message.trim() !== "") {
        return message;
      }
    }
  } catch {
    // The body was not JSON; use the provided fallback.
  }

  return fallback;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: await readErrorMessage(response, "請求失敗，請稍後再試。"),
      };
    }

    try {
      const data = (await response.json()) as T;
      return { ok: true, data };
    } catch {
      return {
        ok: false,
        status: response.status,
        message: "伺服器回應格式不正確，請稍後再試。",
      };
    }
  } catch {
    return {
      ok: false,
      status: 0,
      message: "無法連線到伺服器，請檢查網路連線後再試。",
    };
  }
}

function presentApiError(status: number, message: string): string {
  const normalized = message.trim();

  if (/missing api key/i.test(normalized)) {
    return "請先設定你的 API Key：在右側「API Key 設定」面板選擇供應商並貼上您自己的金鑰。";
  }

  if (status === 401) {
    return "請先登入後再繼續操作（登入狀態可能已逾時）。";
  }

  if (status === 403) {
    return "你沒有執行此操作的權限。";
  }

  if (status === 404) {
    return "找不到指定的資料，請重新整理後再試。";
  }

  if (/host could not be resolved|getaddrinfo|enotfound/i.test(normalized)) {
    return "找不到這個網址的主機，請確認職缺連結是否正確。";
  }

  if (/notion page could not be downloaded/i.test(normalized)) {
    return "無法讀取這個 Notion 頁面，請確認該頁面已在 Notion 開啟「公開分享（Publish / Share to web）」。";
  }

  if (/google docs document could not be downloaded/i.test(normalized)) {
    return "無法讀取這個 Google Docs 文件，請確認檔案權限已設為「知道連結的任何人皆可檢視」。";
  }

  if (
    /enough text|no readable text|extract(ed)? text|content is too short/i.test(
      normalized,
    )
  ) {
    return "無法從這個頁面擷取足夠內容，請確認連結已設為公開分享，或改用手動貼上內容。";
  }

  if (/only (pdf|docx)|10 mb|file is empty|résumé file/i.test(normalized)) {
    return "檔案格式或大小不符，請上傳 10MB 以下的 PDF 或 DOCX 履歷。";
  }

  if (/blob storage|could not be stored|could not be uploaded/i.test(normalized)) {
    return "履歷儲存服務暫時無法使用，請稍後再試。";
  }

  if (
    /provider request failed|timed out|unexpected response|failed validation|malformed json|empty response/i.test(
      normalized,
    )
  ) {
    return "AI 服務暫時無法回應，請確認 API Key 是否正確、供應商額度是否足夠後再試。";
  }

  if (status >= 500 && normalized === "") {
    return "伺服器暫時無法處理請求，請稍後再試。";
  }

  if (normalized !== "") {
    return normalized;
  }

  return "請求失敗，請稍後再試。";
}

function InlineAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "warning" | "info";
  children: ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-indigo-100 bg-indigo-50 text-indigo-900";
  const Icon = tone === "info" ? Info : AlertCircle;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium leading-6 ${toneClass}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function LocaleToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div
      role="group"
      aria-label="切換顯示語言"
      className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-1"
    >
      {(["zh", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={locale === value}
          onClick={() => onChange(value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${FOCUS_RING} ${
            locale === value
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {value === "zh" ? "中文" : "English"}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-500 ring-1 ring-inset ring-slate-200">
        {icon}
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SkillGroup({
  titleZh,
  titleEn,
  items,
  locale,
  tone,
}: {
  titleZh: string;
  titleEn: string;
  items: BilingualList;
  locale: Locale;
  tone: "indigo" | "emerald" | "slate";
}) {
  const values = locale === "zh" ? items.zh : items.en;
  const chipClass =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : tone === "slate"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-indigo-100 bg-indigo-50 text-indigo-800";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{titleZh}</h4>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {titleEn}
        </span>
      </div>

      {values.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${chipClass}`}
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs font-medium text-slate-400">
          此類別在 JD 中未特別提及
        </p>
      )}
    </div>
  );
}

function JdAnalysisView({
  analysis,
  locale,
  aiModel,
}: {
  analysis: JdSkillAnalysis;
  locale: Locale;
  aiModel: string | null;
}) {
  const roleTitle =
    locale === "zh" ? analysis.roleTitle.zh : analysis.roleTitle.en;
  const companySummary =
    locale === "zh" ? analysis.companySummary.zh : analysis.companySummary.en;
  const seniorityLevel =
    locale === "zh"
      ? analysis.seniorityLevel.zh
      : analysis.seniorityLevel.en;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          {seniorityLevel !== "" ? (
            <span
              className={`${BADGE} border-indigo-200 bg-indigo-50 text-indigo-700`}
            >
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              {seniorityLevel}
            </span>
          ) : null}
          {aiModel !== null ? (
            <span
              className={`${BADGE} border-slate-200 bg-white font-mono text-slate-500`}
            >
              {aiModel}
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 text-balance">
          {roleTitle}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          {companySummary}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:gap-5">
        <SkillGroup
          titleZh="核心技術技能"
          titleEn="Core technical skills"
          items={analysis.coreTechnicalSkills}
          locale={locale}
          tone="indigo"
        />
        <SkillGroup
          titleZh="工具與框架"
          titleEn="Tools & frameworks"
          items={analysis.toolsAndFrameworks}
          locale={locale}
          tone="indigo"
        />
        <SkillGroup
          titleZh="軟技能"
          titleEn="Soft skills"
          items={analysis.softSkills}
          locale={locale}
          tone="emerald"
        />
        <SkillGroup
          titleZh="加分條件"
          titleEn="Nice-to-have skills"
          items={analysis.niceToHaveSkills}
          locale={locale}
          tone="emerald"
        />
        <div className="sm:col-span-2">
          <SkillGroup
            titleZh="主要職責"
            titleEn="Key responsibilities"
            items={analysis.keyResponsibilities}
            locale={locale}
            tone="slate"
          />
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tone =
    clamped >= 80
      ? "text-emerald-500"
      : clamped >= 60
        ? "text-indigo-500"
        : clamped >= 40
          ? "text-amber-500"
          : "text-rose-500";

  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="h-36 w-36 -rotate-90"
        role="img"
        aria-label={`整體履歷評分 ${clamped} 分，滿分 100 分`}
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${tone} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight text-slate-900">
          {clamped}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          / 100
        </span>
      </div>
    </div>
  );
}

function ScoreRow({ item, locale }: { item: ResumeScoreItem; locale: Locale }) {
  const category = locale === "zh" ? item.category.zh : item.category.en;
  const feedback = locale === "zh" ? item.feedback.zh : item.feedback.en;
  const percentage =
    item.maxScore > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((item.score / item.maxScore) * 100)),
        )
      : 0;
  const barTone =
    percentage >= 80
      ? "bg-emerald-500"
      : percentage >= 60
        ? "bg-indigo-500"
        : percentage >= 40
          ? "bg-amber-500"
          : "bg-rose-500";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{category}</p>
        <span className="font-mono text-xs text-slate-500">
          {item.score} / {item.maxScore > 0 ? item.maxScore : "—"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${category} 得分`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full ${barTone} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{feedback}</p>
    </div>
  );
}

function ModificationCard({
  item,
  locale,
}: {
  item: ResumeModificationItem;
  locale: Locale;
}) {
  const section = locale === "zh" ? item.section.zh : item.section.en;
  const issue = locale === "zh" ? item.issue.zh : item.issue.en;
  const suggestion =
    locale === "zh" ? item.suggestion.zh : item.suggestion.en;
  const after = locale === "zh" ? item.afterSnippet.zh : item.afterSnippet.en;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <h5 className="text-sm font-semibold text-slate-900">{section}</h5>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
        <span className="font-semibold text-rose-600">問題 </span>
        {issue}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
        <span className="font-semibold text-indigo-600">建議 </span>
        {suggestion}
      </p>

      {item.beforeSnippet.trim() !== "" ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
            原文摘錄
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-rose-900">
            {item.beforeSnippet}
          </pre>
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          建議改寫
        </p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-900">
          {after}
        </p>
      </div>
    </article>
  );
}

function ResumeReviewView({
  review,
  locale,
}: {
  review: ResumeReviewResult;
  locale: Locale;
}) {
  const summary = locale === "zh" ? review.summary.zh : review.summary.en;
  const missingKeywords =
    locale === "zh" ? review.missingKeywords.zh : review.missingKeywords.en;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/60 p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <ScoreRing score={review.overallScore} />
          <div className="min-w-0 text-center sm:text-left">
            <p className={EYEBROW}>OVERALL SCORE</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              整體履歷評分
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{summary}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">評分細項</h4>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Score breakdown
          </span>
        </div>
        {review.scoreBreakdown.length > 0 ? (
          <div className="mt-4 space-y-4">
            {review.scoreBreakdown.map((item, index) => (
              <ScoreRow
                key={`${item.category.zh}-${index}`}
                item={item}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs font-medium text-slate-400">
            本次沒有回傳評分細項。
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">缺少的關鍵字</h4>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Missing keywords
          </span>
        </div>
        {missingKeywords.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingKeywords.map((keyword, index) => (
              <li
                key={`${keyword}-${index}`}
                className="inline-flex items-center rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              >
                {keyword}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs font-medium text-slate-400">
            未發現明顯缺漏的關鍵字。
          </p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">
            履歷修改建議
          </h4>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Before / After
          </span>
        </div>
        {review.modifications.length > 0 ? (
          <div className="mt-3 space-y-3">
            {review.modifications.map((item, index) => (
              <ModificationCard
                key={`${item.section.zh}-${index}`}
                item={item}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs font-medium text-slate-400">
            這次沒有需要修改的段落。
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  expanded,
  onToggle,
}: {
  question: InterviewQuestion;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = `interview-question-${question.id}`;
  const typeMeta = QUESTION_TYPE_META[question.type];
  const difficultyMeta = DIFFICULTY_META[question.difficulty];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-2 font-mono text-xs font-semibold text-white">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={`${BADGE} border-indigo-100 bg-indigo-50 text-indigo-700`}
        >
          {typeMeta.zh}
          <span className="font-mono text-[10px] uppercase">
            {typeMeta.en}
          </span>
        </span>
        <span className={`${BADGE} ${difficultyMeta.className}`}>
          {difficultyMeta.zh} · {difficultyMeta.en}
        </span>
      </div>

      <p className="mt-3 text-base font-semibold leading-7 text-slate-900">
        {question.question.zh}
      </p>
      <p className="mt-1 text-sm italic leading-6 text-slate-500">
        {question.question.en}
      </p>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 ${FOCUS_RING}`}
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        查看測試重點與答案要點
      </button>

      {expanded ? (
        <div
          id={panelId}
          className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            測試重點 Testing focus
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">
            {question.testingFocus.zh}
          </p>
          <p className="mt-1 text-sm italic leading-6 text-slate-500">
            {question.testingFocus.en}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                答案要點 · 中文
              </p>
              {question.referenceAnswerPoints.zh.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700 marker:text-indigo-400">
                  {question.referenceAnswerPoints.zh.map((point, pointIndex) => (
                    <li key={`${point}-${pointIndex}`}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  尚未提供中文答案要點。
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Answer points · EN
              </p>
              {question.referenceAnswerPoints.en.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700 marker:text-indigo-400">
                  {question.referenceAnswerPoints.en.map((point, pointIndex) => (
                    <li key={`${point}-${pointIndex}`}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  No English answer points were provided.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RecordsPanel({
  records,
  loading,
  error,
  activeRecordId,
  deletingId,
  onSelect,
  onDelete,
  onReload,
}: RecordsPanelProps) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-24">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={EYEBROW}>HISTORY</p>
            <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
              我的作品紀錄
            </h3>
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            aria-label="重新載入作品紀錄"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 ${FOCUS_RING}`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          每次 AI 產出都會自動儲存，點選即可載入完整分析。
        </p>

        {error !== null ? (
          <div className="mt-3">
            <InlineAlert>{error}</InlineAlert>
            <button
              type="button"
              onClick={onReload}
              className={`mt-2 ${SECONDARY_BUTTON} w-full`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              重新載入
            </button>
          </div>
        ) : null}

        {loading && records.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 space-y-2"
          >
            <span className="sr-only">正在載入作品紀錄…</span>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="animate-pulse rounded-xl border border-slate-200/70 bg-white p-3"
              >
                <div className="h-3 w-3/4 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && records.length === 0 && error === null ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-500 ring-1 ring-inset ring-slate-200">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              還沒有作品紀錄
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              完成第一次職缺分析後，紀錄會出現在這裡。
            </p>
          </div>
        ) : null}

        {records.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {records.map((item) => {
              const isActive = item.id === activeRecordId;
              const isDeleting = deletingId === item.id;
              const score = item.resumeReview?.overallScore ?? null;

              return (
                <li key={item.id}>
                  <div
                    className={`flex items-stretch gap-1 rounded-xl border transition ${
                      isActive
                        ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-current={isActive ? "true" : undefined}
                      className={`min-w-0 flex-1 rounded-l-xl px-3 py-2.5 text-left ${FOCUS_RING}`}
                    >
                      <span className="line-clamp-2 block text-sm font-semibold text-slate-900">
                        {item.jdTitle}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {formatRecordDate(item.createdAt)}
                        </span>
                        <span className="text-[11px] text-slate-400">·</span>
                        <span className="truncate text-[11px] text-slate-500">
                          {PROVIDER_LABEL[item.aiProvider]} / {item.aiModel}
                        </span>
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        {score !== null ? (
                          <span
                            className={`${BADGE} border-emerald-200 bg-emerald-50 text-emerald-700`}
                          >
                            {score} 分
                          </span>
                        ) : null}
                        {item.resumeSourceType !== null ? (
                          <span
                            className={`${BADGE} border-slate-200 bg-white text-slate-500`}
                          >
                            {RESUME_SOURCE_LABEL[item.resumeSourceType]}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="flex items-center pr-1.5">
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={isDeleting}
                        aria-label={`刪除作品紀錄：${item.jdTitle}`}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {isDeleting ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}

export default function WorkspaceStudio({
  provider,
  apiKey,
  onRecordChange,
}: WorkspaceStudioProps) {
  const baseId = useId();
  const mountedRef = useRef(true);

  const [activeTab, setActiveTab] = useState<StudioTab>("jd");
  const [locale, setLocale] = useState<Locale>("zh");

  const [jdUrl, setJdUrl] = useState("");
  const [jdFallbackText, setJdFallbackText] = useState("");

  const [record, setRecord] = useState<ArtifactRecordDTO | null>(null);

  const [jdPending, setJdPending] = useState(false);
  const [jdError, setJdError] = useState<string | null>(null);

  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeLinkSource, setResumeLinkSource] =
    useState<PublicLinkSource>("google_docs");
  const [resumeLinkUrl, setResumeLinkUrl] = useState("");
  const [resumeUpload, setResumeUpload] = useState<ResumeUploadResult | null>(
    null,
  );
  const [uploadPending, setUploadPending] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [interviewPending, setInterviewPending] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<{
    recordId: string | null;
    ids: number[];
  }>({ recordId: null, ids: [] });

  const [records, setRecords] = useState<ArtifactRecordDTO[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyRecordsResult = useCallback(
    (result: ApiResult<RecordsResponse>): void => {
      setRecordsError(null);
      setRecordsLoading(false);

      if (!result.ok) {
        setRecordsError(presentApiError(result.status, result.message));
        return;
      }

      setRecords(Array.isArray(result.data.records) ? result.data.records : []);
    },
    [],
  );

  const loadRecords = useCallback(async (): Promise<void> => {
    const result = await requestJson<RecordsResponse>("/api/records", {
      method: "GET",
    });

    if (!mountedRef.current) {
      return;
    }

    applyRecordsResult(result);
  }, [applyRecordsResult]);

  useEffect(() => {
    let cancelled = false;

    void requestJson<RecordsResponse>("/api/records", { method: "GET" }).then(
      (result) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        applyRecordsResult(result);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [applyRecordsResult]);

  const interviewQuestions = record?.interviewQuestions?.questions ?? [];
  const activeRecordId = record?.id ?? null;
  const expandedQuestionIds =
    expandedQuestions.recordId === activeRecordId ? expandedQuestions.ids : [];
  const expandedCount = interviewQuestions.filter((question) =>
    expandedQuestionIds.includes(question.id),
  ).length;
  const allQuestionsExpanded =
    interviewQuestions.length > 0 && expandedCount === interviewQuestions.length;
  const questionCount = interviewQuestions.length;
  const questionCountOutOfRange =
    questionCount > 0 && (questionCount < 10 || questionCount > 15);

  function handleRecordSuccess(nextRecord: ArtifactRecordDTO): void {
    setRecord(nextRecord);
    onRecordChange(nextRecord.id);
    void loadRecords();
  }

  function handleRecordFailure(
    status: number,
    message: string,
    setError: (value: string) => void,
  ): void {
    if (status === 404 && record !== null) {
      setRecord(null);
      onRecordChange(null);
      setError("這筆作品紀錄已不存在，已為你重新開始；請再試一次。");
      void loadRecords();
      return;
    }

    setError(presentApiError(status, message));
  }

  function selectRecord(nextRecord: ArtifactRecordDTO): void {
    setRecord(nextRecord);
    onRecordChange(nextRecord.id);
    setJdError(null);
    setResumeError(null);
    setInterviewError(null);

    if (nextRecord.jdUrl.trim() !== "") {
      setJdUrl(nextRecord.jdUrl);
    }
  }

  async function deleteRecord(item: ArtifactRecordDTO): Promise<void> {
    const confirmed = window.confirm(
      `確定要刪除「${item.jdTitle}」這筆作品紀錄嗎？此操作無法復原。`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setRecordsError(null);

    try {
      const response = await fetch(`/api/records/${item.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        setRecordsError(
          presentApiError(
            response.status,
            await readErrorMessage(
              response,
              "刪除作品紀錄失敗，請稍後再試。",
            ),
          ),
        );
        return;
      }

      if (record?.id === item.id) {
        setRecord(null);
        onRecordChange(null);
      }

      await loadRecords();
    } catch {
      setRecordsError("無法連線到伺服器，請檢查網路連線後再試。");
    } finally {
      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  }

  function toggleQuestion(id: number): void {
    setExpandedQuestions((previous) => {
      const currentIds =
        previous.recordId === activeRecordId ? previous.ids : [];

      return {
        recordId: activeRecordId,
        ids: currentIds.includes(id)
          ? currentIds.filter((item) => item !== id)
          : [...currentIds, id],
      };
    });
  }

  function toggleAllQuestions(): void {
    setExpandedQuestions({
      recordId: activeRecordId,
      ids: allQuestionsExpanded
        ? []
        : interviewQuestions.map((question) => question.id),
    });
  }

  function reloadRecords(): void {
    setRecordsLoading(true);
    void loadRecords();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = TABS.length - 1;
    }

    const nextTab = TABS[nextIndex];

    if (nextTab === undefined) {
      return;
    }

    setActiveTab(nextTab.id);
    document.getElementById(`${baseId}-tab-${nextTab.id}`)?.focus();
  }

  async function runJdAnalysis(): Promise<void> {
    setJdError(null);

    if (apiKey.trim() === "") {
      setJdError("請先在右側「API Key 設定」面板填入您自己的 API Key，才能開始 AI 分析。");
      return;
    }

    const url = jdUrl.trim();
    const fallback = jdFallbackText.trim();

    if (url === "" && fallback === "") {
      setJdError("請貼上職缺連結，或手動貼上 JD 內容。");
      return;
    }

    setJdPending(true);

    try {
      const result = await requestJson<AnalyzeResponse>("/api/analyze/jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildRequestBody({
            jdUrl: url,
            jdFallbackText: fallback,
            provider,
            apiKey: apiKey.trim(),
            recordId: record?.id,
          }),
        ),
      });

      if (!result.ok) {
        handleRecordFailure(result.status, result.message, setJdError);
        return;
      }

      const nextRecord = result.data.record;

      if (nextRecord === undefined) {
        setJdError("伺服器未回傳作品紀錄，請稍後再試。");
        return;
      }

      handleRecordSuccess(nextRecord);
    } finally {
      setJdPending(false);
    }
  }

  function handleResumeFileChange(event: ChangeEvent<HTMLInputElement>): void {
    setResumeError(null);
    const file = event.target.files?.[0] ?? null;

    if (file === null) {
      setResumeFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isSupported =
      lowerName.endsWith(".pdf") || lowerName.endsWith(".docx");

    if (!isSupported) {
      setResumeFile(null);
      event.target.value = "";
      setResumeError("僅支援 PDF 或 DOCX 檔案。");
      return;
    }

    if (file.size > MAX_RESUME_BYTES) {
      setResumeFile(null);
      event.target.value = "";
      setResumeError("檔案超過 10MB 上限，請壓縮檔案或改用公開連結。");
      return;
    }

    setResumeFile(file);
  }

  async function uploadResumeFile(): Promise<void> {
    if (resumeFile === null) {
      setResumeError("請先選擇 PDF 或 DOCX 履歷檔案。");
      return;
    }

    setResumeError(null);
    setUploadPending(true);

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);

      const result = await requestJson<ResumeUploadResult>(
        "/api/resume/upload",
        { method: "POST", body: formData },
      );

      if (!result.ok) {
        setResumeError(presentApiError(result.status, result.message));
        return;
      }

      if (result.data.extractedText.trim() === "") {
        setResumeError(
          "系統沒有從這份履歷擷取到文字，請確認檔案內容或改用公開連結。",
        );
        return;
      }

      setResumeUpload({
        ...result.data,
        sourceUrl: result.data.sourceUrl ?? null,
      });
    } finally {
      setUploadPending(false);
    }
  }

  async function importResumeLink(): Promise<void> {
    const url = resumeLinkUrl.trim();

    setResumeError(null);

    if (!isValidHttpUrl(url)) {
      setResumeError(
        "請輸入有效的公開連結（以 http:// 或 https:// 開頭）。",
      );
      return;
    }

    setUploadPending(true);

    try {
      const result = await requestJson<ResumeUploadResult>(
        "/api/resume/upload",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: resumeLinkSource, url }),
        },
      );

      if (!result.ok) {
        setResumeError(presentApiError(result.status, result.message));
        return;
      }

      if (result.data.extractedText.trim() === "") {
        setResumeError(
          "系統沒有從這個連結擷取到文字，請確認連結已公開或改用檔案上傳。",
        );
        return;
      }

      setResumeUpload({
        ...result.data,
        sourceUrl: result.data.sourceUrl ?? null,
      });
    } finally {
      setUploadPending(false);
    }
  }

  async function runResumeAnalysis(): Promise<void> {
    setResumeError(null);

    if (apiKey.trim() === "") {
      setResumeError("請先在右側「API Key 設定」面板填入您自己的 API Key，才能開始 AI 分析。");
      return;
    }

    if (resumeUpload === null) {
      setResumeError("請先上傳履歷或匯入公開連結。");
      return;
    }

    const url = jdUrl.trim();
    const fallback = jdFallbackText.trim();

    if (url === "" && fallback === "" && record === null) {
      setResumeError("請先在上方填入職缺連結，或手動貼上 JD 內容。");
      return;
    }

    setReviewPending(true);

    try {
      const result = await requestJson<AnalyzeResponse>(
        "/api/analyze/resume",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildRequestBody({
              recordId: record?.id,
              jdUrl: url,
              jdFallbackText: fallback,
              resumeText: resumeUpload.extractedText,
              resumeSourceType: resumeUpload.sourceType,
              resumeFileName: resumeUpload.fileName,
              resumeBlobUrl: resumeUpload.blobUrl,
              resumeSourceUrl: resumeUpload.sourceUrl ?? undefined,
              provider,
              apiKey: apiKey.trim(),
            }),
          ),
        },
      );

      if (!result.ok) {
        handleRecordFailure(result.status, result.message, setResumeError);
        return;
      }

      const nextRecord = result.data.record;

      if (nextRecord === undefined) {
        setResumeError("伺服器未回傳作品紀錄，請稍後再試。");
        return;
      }

      handleRecordSuccess(nextRecord);
    } finally {
      setReviewPending(false);
    }
  }

  async function runInterviewGeneration(): Promise<void> {
    const url = jdUrl.trim();
    const fallback = jdFallbackText.trim();

    setInterviewError(null);

    if (apiKey.trim() === "") {
      setInterviewError("請先在右側「API Key 設定」面板填入您自己的 API Key，才能開始 AI 分析。");
      return;
    }

    if (url === "" && fallback === "" && record === null) {
      setInterviewError("請先在上方填入職缺連結，或手動貼上 JD 內容。");
      return;
    }

    setInterviewPending(true);

    try {
      const result = await requestJson<AnalyzeResponse>(
        "/api/analyze/interview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildRequestBody({
              jdUrl: url,
              jdFallbackText: fallback,
              resumeText: resumeUpload?.extractedText,
              provider,
              apiKey: apiKey.trim(),
              recordId: record?.id,
            }),
          ),
        },
      );

      if (!result.ok) {
        handleRecordFailure(result.status, result.message, setInterviewError);
        return;
      }

      const nextRecord = result.data.record;

      if (nextRecord === undefined) {
        setInterviewError("伺服器未回傳作品紀錄，請稍後再試。");
        return;
      }

      handleRecordSuccess(nextRecord);
    } finally {
      setInterviewPending(false);
    }
  }

  const resumePreview =
    resumeUpload === null
      ? ""
      : resumeUpload.extractedText.length > RESUME_PREVIEW_LENGTH
        ? `${resumeUpload.extractedText.slice(0, RESUME_PREVIEW_LENGTH)}…`
        : resumeUpload.extractedText;
  const currentScore = record?.resumeReview?.overallScore ?? null;
  const jdAnalysis = record?.jdAnalysis ?? null;
  const resumeReview = record?.resumeReview ?? null;
  const savedResumeFileName = record?.resumeFileName ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_18.5rem] xl:gap-7 xl:items-start">
      <section className={`${CARD} min-w-0`}>
        <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={EYEBROW}>WORKSPACE STUDIO</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 text-balance sm:text-3xl">
              職缺 × 履歷 × 面試
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
              三個模式共用同一份職缺與作品紀錄：先拆解技能需求，再替履歷打分與重寫，最後生成模擬面試與筆試。
            </p>
          </div>

          {record !== null ? (
            <div className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 sm:max-w-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                目前作品紀錄
              </p>
              <p className="mt-1 line-clamp-2 break-words text-sm font-semibold text-slate-900">
                {record.jdTitle}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {currentScore !== null ? (
                  <span
                    className={`${BADGE} border-emerald-200 bg-emerald-50 text-emerald-700`}
                  >
                    履歷 {currentScore} 分
                  </span>
                ) : null}
                <span
                  className={`${BADGE} border-indigo-100 bg-white font-mono text-indigo-600`}
                >
                  {record.aiModel}
                </span>
              </div>
            </div>
          ) : (
            <span
              className={`${BADGE} shrink-0 border-slate-200 bg-slate-50 text-slate-500`}
            >
              尚未建立作品紀錄
            </span>
          )}
        </header>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-inset ring-slate-200">
              <Target className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                目標職缺 Target role
              </p>
              <p className="text-sm leading-6 text-slate-500">
                三個模式都會使用這裡的職缺內容。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <label
                htmlFor={`${baseId}-jd-url`}
                className="text-xs font-semibold text-slate-700"
              >
                職缺連結{" "}
                <span className="font-normal text-slate-400">JD URL</span>
              </label>
              <input
                id={`${baseId}-jd-url`}
                type="url"
                inputMode="url"
                value={jdUrl}
                onChange={(event) => {
                  setJdUrl(event.target.value);
                  setJdError(null);
                }}
                placeholder="https://company.com/jobs/123"
                className={`${INPUT} mt-1.5`}
              />
            </div>

            <div>
              <label
                htmlFor={`${baseId}-jd-fallback`}
                className="text-xs font-semibold text-slate-700"
              >
                手動貼上 JD 內容（若網站無法抓取）
              </label>
              <textarea
                id={`${baseId}-jd-fallback`}
                value={jdFallbackText}
                onChange={(event) => {
                  setJdFallbackText(event.target.value);
                  setJdError(null);
                }}
                rows={4}
                placeholder="貼上完整的職缺描述，包含職責、必備技能與加分條件…"
                className={`${INPUT} mt-1.5 resize-y`}
              />
            </div>

            <p className="flex items-start gap-1.5 text-sm leading-6 text-slate-500">
              <Link2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              支援 104 / 1111 / LinkedIn / Notion
              等公開頁面；若網站阻擋擷取，請使用手動貼上。
            </p>
            <p className="flex items-start gap-1.5 text-sm leading-6 text-slate-500">
              <KeyRound
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              必須填寫您自己的 API Key 才能執行 AI 分析（金鑰僅儲存於您的瀏覽器本機，系統絕不使用伺服器環境金鑰）。
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="工作區模式"
          onKeyDown={handleTabKeyDown}
          className="mt-6 grid gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-1.5 sm:grid-cols-3"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${FOCUS_RING} ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
                }`}
              >
                <span className="font-mono text-[11px] text-indigo-500">
                  {tab.number}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-jd`}
          aria-labelledby={`${baseId}-tab-jd`}
          hidden={activeTab !== "jd"}
          className="mt-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void runJdAnalysis()}
              disabled={jdPending}
              className={PRIMARY_BUTTON}
            >
              {jdPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {jdPending ? "分析中…" : "開始分析"}
            </button>
            <LocaleToggle locale={locale} onChange={setLocale} />
          </div>

          {jdError !== null ? (
            <div className="mt-3">
              <InlineAlert>{jdError}</InlineAlert>
            </div>
          ) : null}

          <div className="mt-4">
            {jdAnalysis !== null ? (
              <JdAnalysisView
                analysis={jdAnalysis}
                locale={locale}
                aiModel={record?.aiModel ?? null}
              />
            ) : (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                title="尚未產出職缺分析"
                description="貼上職缺連結或手動貼上 JD 內容，點選「開始分析」後，AI 會整理角色定位、核心技能與主要職責。"
              />
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-resume`}
          aria-labelledby={`${baseId}-tab-resume`}
          hidden={activeTab !== "resume"}
          className="mt-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="group"
              aria-label="選擇履歷來源"
              className="grid w-full grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-2"
            >
              <button
                type="button"
                aria-pressed={sourceMode === "file"}
                onClick={() => setSourceMode("file")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${FOCUS_RING} ${
                  sourceMode === "file"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                檔案上傳
                <span className="text-[11px] font-normal text-slate-400">
                  PDF / DOCX
                </span>
              </button>
              <button
                type="button"
                aria-pressed={sourceMode === "link"}
                onClick={() => setSourceMode("link")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${FOCUS_RING} ${
                  sourceMode === "link"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                公開連結
                <span className="text-[11px] font-normal text-slate-400">
                  Google Docs · Notion
                </span>
              </button>
            </div>
            <LocaleToggle locale={locale} onChange={setLocale} />
          </div>

          {resumeError !== null ? (
            <div className="mt-3">
              <InlineAlert>{resumeError}</InlineAlert>
            </div>
          ) : null}

          {sourceMode === "file" ? (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
              <label
                htmlFor={`${baseId}-resume-file`}
                className="text-xs font-semibold text-slate-700"
              >
                履歷檔案{" "}
                <span className="font-normal text-slate-400">
                  PDF / DOCX，上限 10MB
                </span>
              </label>
              <input
                id={`${baseId}-resume-file`}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeFileChange}
                className={`mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 file:mr-3 file:rounded-l-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 ${FOCUS_RING}`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void uploadResumeFile()}
                  disabled={resumeFile === null || uploadPending}
                  className={PRIMARY_BUTTON}
                >
                  {uploadPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileUp className="h-4 w-4" aria-hidden="true" />
                  )}
                  {uploadPending ? "擷取中…" : "上傳並擷取文字"}
                </button>
                {resumeFile !== null ? (
                  <span className="text-xs text-slate-500">
                    {resumeFile.name} · {formatFileSize(resumeFile.size)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
              <div className="grid gap-3">
                <div>
                  <label
                    htmlFor={`${baseId}-resume-source`}
                    className="text-xs font-semibold text-slate-700"
                  >
                    來源類型
                  </label>
                  <select
                    id={`${baseId}-resume-source`}
                    value={resumeLinkSource}
                    onChange={(event) => {
                      const value = event.target.value;

                      if (isPublicLinkSource(value)) {
                        setResumeLinkSource(value);
                        setResumeError(null);
                      }
                    }}
                    className={`${INPUT} mt-1.5`}
                  >
                    <option value="google_docs">
                      Google Docs（公開連結）
                    </option>
                    <option value="notion">Notion（公開頁面）</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`${baseId}-resume-url`}
                    className="text-xs font-semibold text-slate-700"
                  >
                    公開連結 URL
                  </label>
                  <input
                    id={`${baseId}-resume-url`}
                    type="url"
                    inputMode="url"
                    value={resumeLinkUrl}
                    onChange={(event) => {
                      setResumeLinkUrl(event.target.value);
                      setResumeError(null);
                    }}
                    placeholder={
                      resumeLinkSource === "google_docs"
                        ? "https://docs.google.com/document/d/..."
                        : "https://www.notion.site/... 或 https://www.notion.so/..."
                    }
                    className={`${INPUT} mt-1.5`}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => void importResumeLink()}
                    disabled={uploadPending || resumeLinkUrl.trim() === ""}
                    className={PRIMARY_BUTTON}
                  >
                    {uploadPending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    {uploadPending ? "匯入中…" : "匯入公開連結"}
                  </button>
                </div>

                <p className="text-sm leading-relaxed text-slate-500">
                  請確認連結已開放為「知道連結的人可檢視」，否則系統無法擷取內容。
                </p>
              </div>
            </div>
          )}

          {resumeUpload !== null ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CircleCheck
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <p className="min-w-0 break-words text-sm font-semibold text-slate-900">
                  {resumeUpload.fileName}
                </p>
                <span
                  className={`${BADGE} border-emerald-200 bg-white text-emerald-700`}
                >
                  {RESUME_SOURCE_LABEL[resumeUpload.sourceType]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
                {resumeUpload.sourceUrl !== null ? (
                  <a
                    href={resumeUpload.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-indigo-600 transition hover:text-indigo-500 ${FOCUS_RING}`}
                  >
                    原始公開連結
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
                <a
                  href={resumeUpload.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-indigo-600 transition hover:text-indigo-500 ${FOCUS_RING}`}
                >
                  Vercel Blob 檔案
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <summary
                  className={`cursor-pointer select-none text-xs font-semibold text-slate-700 ${FOCUS_RING}`}
                >
                  預覽擷取文字（前 {RESUME_PREVIEW_LENGTH} 字）
                </summary>
                <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-600">
                  {resumePreview}
                </pre>
                <p className="mt-2 text-[11px] text-slate-400">
                  僅顯示前 {RESUME_PREVIEW_LENGTH} 字，完整內容會送往 AI 分析。
                </p>
              </details>
            </div>
          ) : savedResumeFileName !== null ? (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-sm leading-relaxed text-slate-500">
                目前紀錄已保存履歷「{savedResumeFileName}」。若要在本頁重新評分，請重新上傳檔案或匯入公開連結，系統才能取得最新文字內容。
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void runResumeAnalysis()}
              disabled={reviewPending || resumeUpload === null}
              className={PRIMARY_BUTTON}
            >
              {reviewPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Gauge className="h-4 w-4" aria-hidden="true" />
              )}
              {reviewPending ? "評分中…" : "針對此職缺評分"}
            </button>
            {resumeUpload === null ? (
              <p className="text-sm leading-relaxed text-slate-500">
                請先完成履歷上傳或公開連結匯入，才能進行評分。
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            {resumeReview !== null ? (
              <ResumeReviewView review={resumeReview} locale={locale} />
            ) : (
              <EmptyState
                icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
                title="尚未產出履歷評分"
                description="匯入履歷後點選「針對此職缺評分」，AI 會給出 0–100 分的整體評分、分類分數、缺漏關鍵字與逐段改寫建議。"
              />
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-interview`}
          aria-labelledby={`${baseId}-tab-interview`}
          hidden={activeTab !== "interview"}
          className="mt-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void runInterviewGeneration()}
              disabled={interviewPending}
              className={PRIMARY_BUTTON}
            >
              {interviewPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Brain className="h-4 w-4" aria-hidden="true" />
              )}
              {interviewPending ? "生成中…" : "生成模擬面試"}
            </button>

            {questionCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`${BADGE} border-indigo-200 bg-indigo-50 text-indigo-700`}
                >
                  <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                  共 {questionCount} 題
                </span>
                <button
                  type="button"
                  onClick={toggleAllQuestions}
                  className={`${SECONDARY_BUTTON} px-4 py-1.5 text-xs`}
                >
                  {allQuestionsExpanded ? "全部收合" : "全部展開"}
                </button>
              </div>
            ) : null}
          </div>

          {resumeUpload === null ? (
            <p className="mt-3 flex items-start gap-1.5 text-sm leading-6 text-slate-500">
              <ClipboardList
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              目前尚未匯入履歷，題目將以職缺內容為主；先完成履歷評分可讓題目更貼近你的經歷。
            </p>
          ) : null}

          {interviewError !== null ? (
            <div className="mt-3">
              <InlineAlert>{interviewError}</InlineAlert>
            </div>
          ) : null}

          {questionCountOutOfRange ? (
            <div className="mt-3">
              <InlineAlert tone="warning">
                此份結果共 {questionCount} 題，與預期的 10–15
                題不同，建議重新生成以取得完整題庫。
              </InlineAlert>
            </div>
          ) : null}

          <div className="mt-4">
            {questionCount > 0 ? (
              <div className="space-y-3">
                {interviewQuestions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    expanded={expandedQuestionIds.includes(question.id)}
                    onToggle={() => toggleQuestion(question.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Brain className="h-5 w-5" aria-hidden="true" />}
                title="尚未生成模擬面試"
                description="填入職缺後點選「生成模擬面試」，AI 會產生 10–15 題技術、行為、系統設計與筆試題目，並附上測試重點與答案要點。"
              />
            )}
          </div>
        </div>
      </section>

      <RecordsPanel
        records={records}
        loading={recordsLoading}
        error={recordsError}
        activeRecordId={record?.id ?? null}
        deletingId={deletingId}
        onSelect={selectRecord}
        onDelete={(item) => void deleteRecord(item)}
        onReload={reloadRecords}
      />
    </div>
  );
}

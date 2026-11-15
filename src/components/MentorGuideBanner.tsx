"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

import type { PublicUser } from "@/types/domain";

const STORAGE_KEY = "jd_resume_artifact_onboarding";

const STEPS = [
  {
    id: "api-key",
    zh: "設定 AI API Key",
    en: "Configure your AI API key",
  },
  {
    id: "job-url",
    zh: "貼上職缺 JD 連結",
    en: "Paste the job description URL",
  },
  {
    id: "resume",
    zh: "上傳或連結你的履歷",
    en: "Upload or link your resume",
  },
  {
    id: "interview",
    zh: "生成 10–15 題模擬面試",
    en: "Generate 10-15 mock interview questions",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";
const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";

function isStepId(value: unknown): value is StepId {
  return STEPS.some((step) => step.id === value);
}

function persistCompleted(ids: readonly StepId[]): void {
  try {
    if (ids.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage can be unavailable (private browsing); progress stays in memory.
  }
}

export default function MentorGuideBanner({ user }: { user: PublicUser }) {
  const [completed, setCompleted] = useState<StepId[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return;
      }

      const restored = Array.from(new Set(parsed.filter(isStepId)));

      // localStorage is only readable after mount, so this hydration cannot happen during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompleted(restored);
    } catch {
      // Corrupt or unreadable storage should never break the workspace.
    }
  }, []);

  const total = STEPS.length;
  const percentage = Math.round((completed.length / total) * 100);

  function toggleStep(id: StepId): void {
    const next = completed.includes(id)
      ? completed.filter((item) => item !== id)
      : [...completed, id];

    setCompleted(next);
    persistCompleted(next);
  }

  function resetProgress(): void {
    setCompleted([]);
    persistCompleted([]);
  }

  return (
    <section
      aria-labelledby="mentor-guide-title"
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-amber-100/50 blur-3xl"
      />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Image
            src={user.mentor.avatarUrl}
            alt={`${user.mentor.mentorName} 導師頭像`}
            width={136}
            height={136}
            preload
            className="h-[136px] w-[136px] shrink-0 rounded-2xl object-cover shadow-[0_20px_45px_-25px_rgba(49,46,129,0.55)] ring-4 ring-white"
          />

          <div className="min-w-0">
            <span
              className={`${BADGE} border-indigo-100 bg-white/80 text-indigo-700`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              你的專屬導師 / YOUR MENTOR
            </span>

            <h2
              id="mentor-guide-title"
              className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 text-balance"
            >
              {user.mentor.mentorName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-indigo-600">
              {user.mentor.mentorTitle}
            </p>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              {user.mentor.greetingZh}
            </p>
            <p className="mt-1 text-sm italic leading-6 text-slate-500">
              {user.mentor.greetingEn}
            </p>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              男性註冊者配對女性導師、女性註冊者配對男性導師。
            </p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/80 bg-white/85 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={EYEBROW}>導師引導 ONBOARDING</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                已完成 {completed.length}/{total}
              </p>
            </div>
            <button
              type="button"
              onClick={resetProgress}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              重設
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>引導進度</span>
            <span className="text-indigo-600">{percentage}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="導師引導完成進度"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed.length}
            aria-valuetext={`已完成 ${completed.length} / ${total}`}
            className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <ul className="mt-4 space-y-2">
            {STEPS.map((step) => {
              const isChecked = completed.includes(step.id);

              return (
                <li key={step.id}>
                  <label
                    htmlFor={`onboarding-${step.id}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      isChecked
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                    }`}
                  >
                    <input
                      id={`onboarding-${step.id}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleStep(step.id)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-indigo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold ${
                          isChecked
                            ? "text-emerald-900"
                            : "text-slate-800"
                        }`}
                      >
                        {step.zh}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs leading-5 ${
                          isChecked ? "text-emerald-700/80" : "text-slate-500"
                        }`}
                      >
                        {step.en}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  FileSearch,
  FileText,
  Fingerprint,
  KeyRound,
  Languages,
  Lock,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AuthAwareCta from "@/components/AuthAwareCta";

interface FeatureCardProps {
  index: string;
  icon: LucideIcon;
  title: string;
  titleEn: string;
  description: string;
  bullets: string[];
  children: ReactNode;
}

function FeatureCard({
  index,
  icon: Icon,
  title,
  titleEn,
  description,
  bullets,
  children,
}: FeatureCardProps) {
  return (
    <article className="surface-card group flex h-full flex-col transition duration-300 hover:-translate-y-1 hover:border-slate-300/80">
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-4xl font-medium leading-none tracking-tight text-slate-200 transition group-hover:text-indigo-200">
          {index}
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h3>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {titleEn}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {description}
      </p>

      <ul className="mt-5 space-y-2.5">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex gap-2.5 text-sm leading-relaxed text-slate-600"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">{children}</div>
    </article>
  );
}

interface MentorCard {
  name: string;
  englishName: string;
  avatarUrl: string;
  altText: string;
  greetingZh: string;
  greetingEn: string;
  pairing: string;
  accent: string;
  dot: string;
}

const mentors: MentorCard[] = [
  {
    name: "星野 凜",
    englishName: "Rin Hoshino",
    avatarUrl: "/avatars/mentor-female.jpg",
    altText: "星野 凜（Rin Hoshino），女性日本 2D 動漫風格職涯導師",
    greetingZh:
      "你好，我是星野 凜。讓我們一起分析這份職缺，打造能脫穎而出的履歷吧！",
    greetingEn:
      "Hi, I'm Rin Hoshino. Let's analyze this role together and craft a resume that stands out!",
    pairing: "配對男性學員 · 女性導師",
    accent: "border-amber-200/80 bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  {
    name: "神谷 蒼",
    englishName: "Ao Kamiya",
    avatarUrl: "/avatars/mentor-male.jpg",
    altText: "神谷 蒼（Ao Kamiya），男性日本 2D 動漫風格職涯導師",
    greetingZh: "你好，我是神谷 蒼。我會協助你拆解職缺需求，並準備好面試與筆試。",
    greetingEn:
      "Hi, I'm Ao Kamiya. I'll help you break down the job requirements and prepare for interviews and written tests.",
    pairing: "配對女性學員 · 男性導師",
    accent: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
];

const trustChips = [
  "中英雙語輸出",
  "10–15 題模擬面試",
  "PDF・DOCX・Google Docs・Notion",
];

const stats = [
  { value: "3", label: "家 AI 供應商", detail: "OpenAI・Gemini・Ollama" },
  { value: "1", label: "天登入 session", detail: "到期後重新登入即可" },
  { value: "0", label: "筆 API Key 上傳", detail: "只留在瀏覽器 localStorage" },
];

interface StepItem {
  icon: LucideIcon;
  label: string;
  title: string;
  titleEn: string;
  description: string;
}

const steps: StepItem[] = [
  {
    icon: UserRound,
    label: "01",
    title: "註冊帳號",
    titleEn: "Create account",
    description:
      "選擇性別以配對專屬導師：男性註冊者配對女性導師，女性註冊者配對男性導師。",
  },
  {
    icon: KeyRound,
    label: "02",
    title: "設定 API Key",
    titleEn: "Add your API key",
    description:
      "選擇 OpenAI、Gemini 或 Ollama Cloud，金鑰僅儲存在瀏覽器 localStorage。",
  },
  {
    icon: UploadCloud,
    label: "03",
    title: "貼上職缺與上傳履歷",
    titleEn: "Paste the JD & upload",
    description:
      "貼上職缺連結，並上傳 PDF、DOCX，或提供 Google Docs、Notion 公開連結。",
  },
  {
    icon: Sparkles,
    label: "04",
    title: "取得雙語分析與面試題",
    titleEn: "Receive bilingual insights",
    description:
      "一次取得技能地圖、0–100 履歷評分與改寫建議，以及 10–15 題模擬面試與筆試。",
  },
];

const providers = [
  { name: "OpenAI", model: "gpt-6-luna", dot: "bg-emerald-500" },
  { name: "Gemini", model: "gemini-3.8-flash", dot: "bg-indigo-500" },
  {
    name: "Ollama Cloud",
    model: "deepseek-v4.1-flash:1017",
    dot: "bg-amber-500",
  },
];

const privacyPoints = [
  "金鑰僅存在瀏覽器 localStorage，不會寫入資料庫。",
  "重新載入頁面仍會保留，不需要重複輸入。",
  "清除瀏覽器網站資料時，金鑰會一併移除。",
];

const privacyNotice =
  "「我們不會保存您的 API Key —— 金鑰僅儲存於您的瀏覽器本機 localStorage，不會上傳至資料庫。」";

const resumeSources = ["PDF", "DOCX", "Google Docs", "Notion", "Vercel Blob"];

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="absolute -left-24 top-56 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
        </div>

        <div className="shell pb-14 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-indigo-600 shadow-sm sm:text-xs">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI CAREER STUDIO · 求職履歷工作台
              </span>

              <h1 className="mt-5 text-balance text-[2rem] font-semibold leading-[1.18] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.45rem]">
                <span>讓每一份履歷，</span>
                <span className="text-indigo-600">都精準對上這份職缺。</span>
              </h1>

              <p className="mt-4 text-base font-medium text-slate-500 sm:text-lg">
                Bilingual JD analysis, resume scoring &amp; mock interviews.
              </p>

              <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
                貼上職缺連結、上傳履歷，幾分鐘內取得中英雙語技能地圖、0–100
                履歷評分與具體改寫建議，以及 10–15
                題模擬面試與筆試。讓下一次投遞，有跡可循。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <AuthAwareCta
                  className="btn-primary group w-full sm:w-auto"
                  guestLabel="免費開始"
                  showArrow
                />
                <Link href="/workspace" className="btn-secondary w-full sm:w-auto">
                  進入工作台
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap gap-2">
                {trustChips.map((chip) => (
                  <li key={chip} className="chip bg-white/80">
                    <Check className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                    {chip}
                  </li>
                ))}
              </ul>

              <dl className="mt-10 grid grid-cols-3 divide-x divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
                {stats.map((stat) => (
                  <div key={stat.label} className="px-3 py-4 sm:px-5 sm:py-5">
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        {stat.value}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium leading-snug text-slate-500 sm:text-xs">
                        {stat.label}
                      </span>
                      <span className="mt-1 hidden text-[10px] leading-snug text-slate-400 sm:block">
                        {stat.detail}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-[27rem] lg:max-w-none">
              <div
                aria-hidden="true"
                className="absolute -inset-5 -z-10 rounded-[2.75rem] bg-linear-to-br from-indigo-200/70 via-white to-amber-100/70 blur-2xl"
              />

              <div className="relative rounded-[2rem] border border-slate-200/80 bg-white p-3 shadow-[0_40px_110px_-50px_rgba(15,23,42,0.55)] sm:p-5">
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Your career studio
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Mentor online
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-slate-100">
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src="/avatars/mentor-female.jpg"
                      alt="星野 凜（Rin Hoshino），女性日本 2D 動漫風格職涯導師"
                      fill
                      sizes="(max-width: 640px) 88vw, (max-width: 1024px) 46vw, 420px"
                      className="object-cover"
                      loading="eager"
                      fetchPriority="high"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/85 via-slate-950/25 to-transparent p-4 pt-16 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
                      Mentor match
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">
                      星野 凜{" "}
                      <span className="text-sm font-normal text-white/70">
                        Rin Hoshino
                      </span>
                    </p>
                    <p className="text-xs text-white/70">
                      資深職涯導師 · Senior Career Mentor
                    </p>
                  </div>
                  <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-700 backdrop-blur">
                    為你而選
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <span>JD match</span>
                      <span className="text-indigo-600">92%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[92%] rounded-full bg-linear-to-r from-indigo-500 to-indigo-400" />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      核心技能、工具與職責已對標
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <span>Resume score</span>
                      <span className="text-emerald-600">86</span>
                    </div>
                    <div className="mt-3 flex h-8 items-end gap-1" aria-hidden="true">
                      <span className="h-3 w-full rounded-sm bg-indigo-100" />
                      <span className="h-5 w-full rounded-sm bg-indigo-200" />
                      <span className="h-7 w-full rounded-sm bg-indigo-400" />
                      <span className="h-4 w-full rounded-sm bg-indigo-200" />
                      <span className="h-6 w-full rounded-sm bg-indigo-500" />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      分類評分與改善優先順序
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-indigo-50/80 p-3">
                  <Sparkles
                    className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] leading-relaxed text-indigo-900/80">
                    「讓我們一起把這份職缺，變成你的下一份錄取通知。」
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="mentors" className="shell scroll-mt-24 py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Your mentor</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            每一次對話，都有一位懂你的導師。
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600">
            男性註冊者配對女性導師，女性註冊者配對男性導師。中英雙語問候，讓分析與回饋更像一場真正的職涯諮詢。
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:gap-8">
          {mentors.map((mentor) => (
            <article key={mentor.name} className="surface-card group overflow-hidden">
              <div className="relative overflow-hidden rounded-3xl bg-slate-100">
                <Image
                  src={mentor.avatarUrl}
                  alt={mentor.altText}
                  width={1024}
                  height={1024}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
                <span
                  className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold ${mentor.accent}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${mentor.dot}`}
                    aria-hidden="true"
                  />
                  {mentor.pairing}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {mentor.name}
                </h3>
                <span className="text-sm font-medium text-slate-400">
                  {mentor.englishName}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                <BadgeCheck
                  className="h-4 w-4 shrink-0 text-indigo-500"
                  aria-hidden="true"
                />
                資深職涯導師
                <span className="text-slate-300">/</span>
                Senior Career Mentor
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    中文問候
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {mentor.greetingZh}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-100/80 bg-indigo-50/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
                    English
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {mentor.greetingEn}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/60">
        <div className="shell py-16 sm:py-20 lg:py-24">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">What you get</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                從職缺解析到面試準備，一次完成。
              </h2>
              <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600">
                不是通用建議，而是針對這份 JD 與這份履歷的雙語對照。
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Languages className="h-4 w-4 text-indigo-500" aria-hidden="true" />
              所有分析皆提供 zh / en 雙語輸出
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:gap-5 xl:gap-6">
            <FeatureCard
              index="01"
              icon={FileSearch}
              title="職缺技能地圖"
              titleEn="JD Skill Map"
              description="把一份職缺拆成可行動的技能清單，先知道對方真正在意什麼。"
              bullets={[
                "貼上職缺 URL，自動擷取職責與必備條件",
                "核心技術、工具框架、軟實力分層整理",
                "加分條件與關鍵職責中英對照",
              ]}
            >
              <div
                aria-hidden="true"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    JD skill map
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                    ZH / EN
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">
                      核心技術
                    </span>
                    <span className="text-[10px] text-slate-400">6 項</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["TypeScript", "React", "Next.js", "API 設計", "測試", "效能"].map(
                      (skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {skill}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Tools
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-600">
                      Tailwind・Figma
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Soft skills
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-600">
                      溝通協作
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2">
                  <span className="text-[10px] font-medium text-indigo-700">
                    Nice to have
                  </span>
                  <span className="text-[10px] text-indigo-500">+ 3 項</span>
                </div>
              </div>
            </FeatureCard>

            <FeatureCard
              index="02"
              icon={PenLine}
              title="履歷評分與重寫"
              titleEn="Resume Score & Rewrite"
              description="用職缺需求對照履歷，找出關鍵字缺口與最能加分的改寫方式。"
              bullets={[
                "0–100 總分與分類評分，一眼看出落差",
                "缺少關鍵字與 ATS 友善度建議",
                "before / after 段落重寫，直接套用",
              ]}
            >
              <div
                aria-hidden="true"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        "conic-gradient(#4f46e5 0 86%, #e2e8f0 86% 100%)",
                    }}
                  >
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-xl font-semibold tracking-tight text-slate-900">
                        86
                      </span>
                      <span className="text-[9px] text-slate-400">/ 100</span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    {[
                      { label: "技能對標", value: 92, bar: "w-[92%]" },
                      { label: "影響力", value: 78, bar: "w-[78%]" },
                      { label: "關鍵字", value: 84, bar: "w-[84%]" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className={`h-full rounded-full bg-indigo-500 ${item.bar}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Before
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 line-through decoration-slate-300">
                    負責前端開發與維護。
                  </p>
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    After
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-700">
                    重構 12 個核心流程，LCP 從 4.1s 降至 1.8s。
                  </p>
                </div>
              </div>
            </FeatureCard>

            <FeatureCard
              index="03"
              icon={MessageSquareText}
              title="模擬面試與筆試"
              titleEn="Interview & Written Test"
              description="把履歷與職缺放進同一場模擬面試，提前準備會被追問的細節。"
              bullets={[
                "依 JD 生成 10–15 題專屬題庫",
                "技術、行為、系統設計、筆試四種題型",
                "每題附測試重點與參考答案要點",
              ]}
            >
              <div
                aria-hidden="true"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Interview set
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                    12 題
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-600">
                        技術題
                      </span>
                      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        Medium
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-700">
                      如何設計可觀測的快取失效策略？
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      測試重點：取捨、監控、失效邊界
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                        行為題
                      </span>
                      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        STAR
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-700">
                      請描述一次你推翻原有技術方案的經驗。
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      參考答案要點：情境、決策、影響
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2">
                    <span className="text-[10px] font-medium text-indigo-700">
                      系統設計・筆試題
                    </span>
                    <span className="text-[10px] text-indigo-500">+ 10 題</span>
                  </div>
                </div>
              </div>
            </FeatureCard>
          </div>
        </div>
      </section>

      <section className="shell py-16 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              四個步驟，開始你的下一份投遞。
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600">
              從註冊到取得分析，不需要安裝任何工具；API Key
              也可以在需要時再設定。
            </p>
            <AuthAwareCta
              className="btn-secondary group mt-6"
              guestLabel="建立帳號"
              showArrow
            />
          </div>

          <ol className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm sm:p-5"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {index < steps.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="mt-2 w-px flex-1 bg-slate-200/80"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold text-indigo-500">
                        STEP {step.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        {step.titleEn}
                      </span>
                    </div>
                    <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="privacy" className="shell scroll-mt-24 pb-16 sm:pb-20 lg:pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div className="relative overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-400/40 blur-3xl" />
              <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-amber-300/15 blur-3xl" />
              <Fingerprint className="absolute -right-6 -top-6 h-32 w-32 text-white/10" />
            </div>

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                API Key privacy
              </span>

              <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                您的金鑰，只留在您的瀏覽器。
              </h2>

              <p className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-medium leading-relaxed text-white sm:p-5">
                {privacyNotice}
              </p>

              <ul className="mt-6 space-y-3 text-sm text-indigo-50">
                {privacyPoints.map((point) => (
                  <li key={point} className="flex gap-2.5 leading-relaxed">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-indigo-200"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/15 bg-indigo-500/30 p-4">
                <ShieldCheck
                  className="h-7 w-7 shrink-0 text-indigo-100"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-indigo-100">
                  重新載入頁面仍會保留金鑰；清除瀏覽器網站資料時一併移除。後端不會將金鑰寫入資料庫。
                </p>
              </div>
            </div>
          </div>

          <div className="surface-card">
            <p className="eyebrow">Bring your own model</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              支援的 AI 供應商與模型
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              選擇你慣用的供應商，在金鑰欄位貼上 API Key 即可開始。
            </p>

            <table className="mt-6 w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                JD Resume Artifact 支援的 AI 供應商與固定模型
              </caption>
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <th scope="col" className="w-[42%] pb-2 pr-2 font-semibold">
                    供應商
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    模型
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {providers.map((provider) => (
                  <tr key={provider.name}>
                    <th
                      scope="row"
                      className="py-3.5 pr-2 align-top text-sm font-semibold text-slate-800"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${provider.dot}`}
                          aria-hidden="true"
                        />
                        {provider.name}
                      </span>
                    </th>
                    <td className="break-all py-3.5 font-mono text-xs text-slate-500">
                      {provider.model}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                履歷來源與儲存
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                支援 PDF、DOCX、Google Docs 與 Notion
                公開連結。上傳檔案與文字快照會儲存於 Vercel Blob，方便你日後回顧。
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {resumeSources.map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell pb-20 sm:pb-24 lg:pb-28">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-indigo-600 px-6 py-14 text-center shadow-[0_40px_110px_-50px_rgba(49,46,129,0.7)] sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-indigo-400/40 blur-3xl" />
            <div className="absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">
            Start with one job
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            從一份職缺開始，讓下一次投遞更有把握。
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-indigo-100 sm:text-base">
            建立帳號、選擇導師，貼上職缺與履歷，帶走一份能直接行動的雙語求職報告。
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <AuthAwareCta
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
              guestLabel="免費開始"
              showArrow
            />
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
            >
              進入工作台
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-5 text-[11px] text-indigo-200">
            1 天登入 session · API Key 僅存於瀏覽器 · 10–15 題模擬面試
          </p>
        </div>
      </section>
    </>
  );
}

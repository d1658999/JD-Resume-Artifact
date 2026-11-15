import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC } from "next/font/google";
import FooterAuthLinks from "@/components/FooterAuthLinks";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansTc = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JD Resume Artifact｜雙語求職履歷工作台",
    template: "%s｜JD Resume Artifact",
  },
  description:
    "JD Resume Artifact 是結合職缺解析、履歷評分與模擬面試的雙語求職工作台。貼上職缺連結、上傳履歷，即可取得中英雙語技能地圖、0–100 履歷評分與 before/after 改寫建議，以及 10–15 題模擬面試與筆試。Bilingual JD analysis, resume scoring, and mock interviews.",
  keywords: [
    "JD 分析",
    "履歷健檢",
    "履歷評分",
    "模擬面試",
    "求職",
    "雙語履歷",
    "AI 職涯",
    "JD analysis",
    "resume review",
    "mock interview",
    "bilingual resume",
  ],
  applicationName: "JD Resume Artifact",
  authors: [{ name: "JD Resume Artifact" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansTc.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-[var(--color-canvas)] font-sans text-slate-900"
      >
        <Navbar />
        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200/80 bg-white/70">
          <div className="shell flex flex-col gap-6 py-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-[11px] font-bold tracking-tight text-white">
                JD
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">
                  JD Resume Artifact
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  © 2026 JD Resume Artifact
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end lg:gap-2">
              <FooterAuthLinks />
              <p className="text-xs leading-relaxed text-slate-500">
                「API Key 僅儲存於您的瀏覽器，不會上傳至資料庫。」
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

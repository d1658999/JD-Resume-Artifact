"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { fetchCurrentUser, notifyAuthChanged } from "@/lib/auth-client";
import type { PublicUser } from "@/types/domain";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CARD_CLASS =
  "rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.5)] sm:p-8";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-slate-700";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

type LoginField = "email" | "password";
type LoginErrors = Partial<Record<LoginField, string>>;
type AuthSuccessPayload = { user: PublicUser };

function isAuthSuccessPayload(value: unknown): value is AuthSuccessPayload {
  if (typeof value !== "object" || value === null || !("user" in value)) {
    return false;
  }

  const { user } = value as { user?: unknown };

  return typeof user === "object" && user !== null;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const { error } = payload as { error?: unknown };

    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }

  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function redirectAuthenticatedUser() {
      try {
        const currentUser = await fetchCurrentUser(controller.signal);

        if (currentUser && !controller.signal.aborted) {
          router.replace("/workspace");
        }
      } catch {
        // Aborted or failed session checks leave the visitor on the form.
      }
    }

    void redirectAuthenticatedUser();

    return () => controller.abort();
  }, [router]);

  function clearFieldError(field: LoginField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const trimmedEmail = email.trim();
    const nextErrors: LoginErrors = {};

    if (!trimmedEmail) {
      nextErrors.email = "請輸入電子郵件。";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "請輸入有效的電子郵件地址。";
    }

    if (!password) {
      nextErrors.password = "請輸入密碼。";
    }

    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const payload = await readJsonBody(response);

      if (!response.ok) {
        setFormError(
          response.status === 401
            ? "電子郵件或密碼不正確，請再試一次。"
            : extractErrorMessage(payload, "登入失敗，請稍後再試。"),
        );
        return;
      }

      if (!isAuthSuccessPayload(payload)) {
        setFormError("伺服器回應格式不正確，請稍後再試。");
        return;
      }

      notifyAuthChanged();
      router.replace("/workspace");
      router.refresh();
    } catch {
      setFormError("無法連線至伺服器，請稍後再試。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="login-title"
      className="relative isolate flex min-h-screen w-full flex-1 items-center justify-center overflow-hidden bg-[#F6F7FB] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div
          className={`${CARD_CLASS} grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10`}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              MEMBER SIGN IN · 會員登入
            </p>
            <h1
              id="login-title"
              className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            >
              歡迎回來
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              登入後繼續你的職缺分析與面試準備。
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sign in to continue your job analysis and interview prep.
            </p>

            {formError ? (
              <div
                role="alert"
                aria-live="polite"
                className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              >
                <CircleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="min-w-0">{formError}</p>
              </div>
            ) : null}

            <form
              noValidate
              onSubmit={handleSubmit}
              aria-busy={pending}
              className="mt-6 space-y-5"
            >
              <div>
                <label htmlFor="login-email" className={LABEL_CLASS}>
                  電子郵件{" "}
                  <span className="font-normal text-slate-400">Email</span>
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  disabled={pending}
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "login-email-error" : undefined
                  }
                  className={`${INPUT_CLASS} disabled:bg-slate-50`}
                />
                {errors.email ? (
                  <p
                    id="login-email-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="login-password" className={LABEL_CLASS}>
                  密碼 <span className="font-normal text-slate-400">Password</span>
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearFieldError("password");
                    }}
                    disabled={pending}
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "login-password-error" : undefined
                    }
                    className={`${INPUT_CLASS} disabled:bg-slate-50 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    aria-pressed={showPassword}
                    aria-controls="login-password"
                    disabled={pending}
                    className="absolute inset-y-0 right-1 my-auto flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p
                    id="login-password-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={pending}
                className={`${PRIMARY_BUTTON_CLASS} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 focus-visible:ring-offset-2`}
              >
                {pending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    登入中…
                  </>
                ) : (
                  <>
                    登入
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
              <p className="text-sm text-slate-600">
                {"還沒有帳號？"}
                <Link
                  href="/register"
                  className="font-semibold text-indigo-600 underline-offset-4 transition hover:text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
                >
                  建立帳號
                </Link>
              </p>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>登入狀態會透過 HTTP-only Cookie 保留 1 天。</span>
              </p>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <Lock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>API Key 只會儲存在你的瀏覽器 localStorage。</span>
              </p>
            </div>
          </div>

          <aside
            aria-label="專屬導師與功能介紹"
            className="min-w-0 rounded-2xl border border-slate-200/70 bg-linear-to-br from-indigo-50 via-white to-amber-50 p-5 sm:p-6"
          >
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                YOUR MENTOR · 專屬導師
              </p>
            </div>
            <h2 className="mt-3 text-balance text-xl font-semibold tracking-tight text-slate-900">
              日本 2D 動畫導師，一對一陪你準備
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              登入後，由你的專屬日本 2D
              動畫導師帶領你完成職缺分析、履歷健檢與模擬面試。
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your personal Japanese 2D-animation mentor guides you through job
              analysis, resume review, and mock interviews.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/80 bg-white/80 p-3 text-center shadow-sm">
                <Image
                  src="/avatars/mentor-female.jpg"
                  alt="女性導師 星野 凜"
                  width={96}
                  height={96}
                  sizes="96px"
                  className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-900/5"
                />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  星野 凜
                </p>
                <p className="text-xs leading-4 text-slate-500">
                  女性導師 · Female mentor
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/80 bg-white/80 p-3 text-center shadow-sm">
                <Image
                  src="/avatars/mentor-male.jpg"
                  alt="男性導師 神谷 蒼"
                  width={96}
                  height={96}
                  sizes="96px"
                  className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-900/5"
                />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  神谷 蒼
                </p>
                <p className="text-xs leading-4 text-slate-500">
                  男性導師 · Male mentor
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                  <ScanSearch className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-sm font-medium text-slate-700">
                  雙語分析
                  <span className="block text-xs font-normal text-slate-500">
                    Bilingual JD analysis
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-sm font-medium text-slate-700">
                  履歷評分
                  <span className="block text-xs font-normal text-slate-500">
                    Resume scoring
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                  <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-sm font-medium text-slate-700">
                  10–15 題面試
                  <span className="block text-xs font-normal text-slate-500">
                    Interview drills
                  </span>
                </span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

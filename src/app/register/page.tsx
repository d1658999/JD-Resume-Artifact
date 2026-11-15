"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  Info,
  Loader2,
  MessagesSquare,
  ScanSearch,
  Sparkles,
} from "lucide-react";

import type { Gender, PublicUser } from "@/types/domain";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CARD_CLASS =
  "rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.5)] sm:p-8";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-slate-700";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

type RegisterField = "name" | "email" | "password" | "gender" | "captcha";
type RegisterErrors = Partial<Record<RegisterField, string>>;
type AuthSuccessPayload = { user: PublicUser };

type MentorSummary = {
  role: string;
  name: string;
  avatarUrl: string;
  alt: string;
};

const MALE_REGISTRANT_MENTOR: MentorSummary = {
  role: "女性導師",
  name: "星野 凜",
  avatarUrl: "/avatars/mentor-female.jpg",
  alt: "女性導師 星野 凜",
};

const FEMALE_REGISTRANT_MENTOR: MentorSummary = {
  role: "男性導師",
  name: "神谷 蒼",
  avatarUrl: "/avatars/mentor-male.jpg",
  alt: "男性導師 神谷 蒼",
};

const GENDER_OPTIONS = [
  {
    value: "male",
    labelZh: "男性",
    labelEn: "Male",
    mentor: MALE_REGISTRANT_MENTOR,
  },
  {
    value: "female",
    labelZh: "女性",
    labelEn: "Female",
    mentor: FEMALE_REGISTRANT_MENTOR,
  },
] as const satisfies ReadonlyArray<{
  value: Gender;
  labelZh: string;
  labelEn: string;
  mentor: MentorSummary;
}>;

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

function isCaptchaRelatedMessage(message: string): boolean {
  return /captcha|verification|驗證碼/i.test(message);
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [captcha, setCaptcha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function clearFieldError(field: RegisterField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors: RegisterErrors = {};

    if (!trimmedName) {
      nextErrors.name = "請輸入姓名。";
    }

    if (!trimmedEmail) {
      nextErrors.email = "請輸入電子郵件。";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "請輸入有效的電子郵件地址。";
    }

    if (!password) {
      nextErrors.password = "請輸入密碼。";
    } else if (password.length < 6) {
      nextErrors.password = "密碼至少需要 6 個字元。";
    }

    if (!gender) {
      nextErrors.gender = "請選擇性別。";
    }

    if (!captcha) {
      nextErrors.captcha = "請輸入驗證碼。";
    } else if (captcha !== "job888") {
      nextErrors.captcha = "驗證碼錯誤，請輸入 job888。";
    }

    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0 || !gender) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          name: trimmedName,
          gender,
          captcha,
        }),
      });

      const payload = await readJsonBody(response);

      if (!response.ok) {
        const serverMessage = extractErrorMessage(
          payload,
          "註冊失敗，請稍後再試。",
        );

        if (response.status === 409) {
          setFormError("此電子郵件已註冊，請直接登入。");
        } else if (
          response.status === 400 &&
          isCaptchaRelatedMessage(serverMessage)
        ) {
          setFormError("驗證碼錯誤，請輸入 job888。");
        } else {
          setFormError(serverMessage);
        }

        return;
      }

      if (!isAuthSuccessPayload(payload)) {
        setFormError("伺服器回應格式不正確，請稍後再試。");
        return;
      }

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
      aria-labelledby="register-title"
      className="relative isolate flex min-h-screen w-full flex-1 items-center justify-center overflow-hidden bg-[#F6F7FB] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:gap-8">
        <form
          noValidate
          onSubmit={handleSubmit}
          aria-busy={pending}
          className={`${CARD_CLASS} mx-auto w-full min-w-0 max-w-2xl`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
            CREATE ACCOUNT · 建立帳號
          </p>
          <h1
            id="register-title"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            開始你的求職升級計畫
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            建立帳號，讓專屬導師陪你完成職缺分析、履歷健檢與模擬面試。
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Create your account and start your job-search upgrade with a
            personal mentor.
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

          <div className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="register-name" className={LABEL_CLASS}>
                  姓名 <span className="font-normal text-slate-400">Name</span>
                </label>
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="請輸入你的姓名"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                  }}
                  disabled={pending}
                  required
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={
                    errors.name ? "register-name-error" : undefined
                  }
                  className={`${INPUT_CLASS} disabled:bg-slate-50`}
                />
                {errors.name ? (
                  <p
                    id="register-name-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="register-email" className={LABEL_CLASS}>
                  電子郵件{" "}
                  <span className="font-normal text-slate-400">Email</span>
                </label>
                <input
                  id="register-email"
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
                    errors.email ? "register-email-error" : undefined
                  }
                  className={`${INPUT_CLASS} disabled:bg-slate-50`}
                />
                {errors.email ? (
                  <p
                    id="register-email-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className={LABEL_CLASS}>
                密碼 <span className="font-normal text-slate-400">Password</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
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
                    errors.password
                      ? "register-password-hint register-password-error"
                      : "register-password-hint"
                  }
                  className={`${INPUT_CLASS} disabled:bg-slate-50 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                  aria-pressed={showPassword}
                  aria-controls="register-password"
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
              <p
                id="register-password-hint"
                className="mt-1.5 text-xs text-slate-500"
              >
                至少 6 個字元{" "}
                <span className="text-slate-400">At least 6 characters</span>
              </p>
              {errors.password ? (
                <p
                  id="register-password-error"
                  className="mt-1.5 text-sm text-rose-600"
                >
                  {errors.password}
                </p>
              ) : null}
            </div>

            <fieldset
              className="min-w-0"
              aria-describedby={
                errors.gender ? "register-gender-error" : undefined
              }
              aria-invalid={Boolean(errors.gender)}
            >
              <legend className="mb-1.5 block text-sm font-medium text-slate-700">
                性別 <span className="font-normal text-slate-400">Gender</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {GENDER_OPTIONS.map((option) => {
                  const selected = gender === option.value;

                  return (
                    <label
                      key={option.value}
                      htmlFor={`register-gender-${option.value}`}
                      className={`relative flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-indigo-100 ${
                        selected
                          ? "border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        id={`register-gender-${option.value}`}
                        name="gender"
                        type="radio"
                        value={option.value}
                        checked={selected}
                        onChange={() => {
                          setGender(option.value);
                          clearFieldError("gender");
                        }}
                        disabled={pending}
                        required
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          selected
                            ? "border-indigo-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selected ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">
                          {option.labelZh}{" "}
                          <span className="font-normal text-slate-400">
                            {option.labelEn}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">
                          配對導師：{option.mentor.role} {option.mentor.name}
                        </span>
                      </span>
                      <Image
                        src={option.mentor.avatarUrl}
                        alt={option.mentor.alt}
                        width={56}
                        height={56}
                        sizes="56px"
                        className={`h-14 w-14 shrink-0 rounded-xl object-cover transition ${
                          selected
                            ? "opacity-100 ring-2 ring-indigo-300"
                            : "opacity-70 ring-1 ring-slate-900/5"
                        }`}
                      />
                    </label>
                  );
                })}
              </div>
              {errors.gender ? (
                <p
                  id="register-gender-error"
                  className="mt-1.5 text-sm text-rose-600"
                >
                  {errors.gender}
                </p>
              ) : null}
            </fieldset>

            <div>
              <label htmlFor="register-captcha" className={LABEL_CLASS}>
                驗證碼{" "}
                <span className="font-normal text-slate-400">
                  Verification code
                </span>
              </label>
              <input
                id="register-captcha"
                name="captcha"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="請輸入 job888"
                value={captcha}
                onChange={(event) => {
                  setCaptcha(event.target.value);
                  clearFieldError("captcha");
                }}
                disabled={pending}
                required
                aria-invalid={Boolean(errors.captcha)}
                aria-describedby={
                  errors.captcha
                    ? "register-captcha-error register-captcha-hint"
                    : "register-captcha-hint"
                }
                className={`${INPUT_CLASS} disabled:bg-slate-50`}
              />
              {errors.captcha ? (
                <p
                  id="register-captcha-error"
                  className="mt-1.5 text-sm text-rose-600"
                >
                  {errors.captcha}
                </p>
              ) : null}
              <div
                id="register-captcha-hint"
                className="mt-2 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3"
              >
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-sm text-indigo-900">
                  <p className="font-semibold">
                    驗證碼提示：<span className="font-mono tracking-wide">job888</span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-indigo-700">
                    請輸入完整驗證碼，區分大小寫
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                所有欄位皆為必填 · All fields are required.
              </p>
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
                    建立帳號中…
                  </>
                ) : (
                  <>
                    建立帳號
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
            <p className="text-sm text-slate-600">
              {"已經有帳號？"}
              <Link
                href="/login"
                className="font-semibold text-indigo-600 underline-offset-4 transition hover:text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
              >
                前往登入
              </Link>
            </p>
            <p className="text-xs leading-5 text-slate-500">
              男性註冊者由女性導師帶領，女性註冊者由男性導師帶領。
            </p>
          </div>
        </form>

        <aside
          aria-labelledby="register-benefits-title"
          className="w-full min-w-0 self-start rounded-3xl border border-slate-200/80 bg-linear-to-br from-indigo-50 via-white to-amber-50 p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.5)] sm:p-8"
        >
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">
              WHY IT WORKS · 為什麼有效
            </p>
          </div>
          <h2
            id="register-benefits-title"
            className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900"
          >
            從職缺到 offer，一條龍準備。
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            依照你的性別配對專屬日本 2D
            動畫導師，從第一份 JD 到最後一場面試，都有清楚的下一步。
          </p>

          <ul className="mt-6 space-y-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                <ScanSearch className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  雙語 JD 分析
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  逐條拆解必備技能、工具與加分項。
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  履歷健檢評分
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  找出缺口，取得可執行的修改建議。
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
                <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  10–15 題模擬面試
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  中英雙語題庫與回答要點，一次練完。
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              MENTOR PAIRING · 導師配對
            </p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/avatars/mentor-female.jpg"
                  alt="女性導師 星野 凜"
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-900/5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">星野 凜</p>
                  <p className="text-xs text-slate-500">
                    男性註冊者 · 女性導師
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Image
                  src="/avatars/mentor-male.jpg"
                  alt="男性導師 神谷 蒼"
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-900/5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">神谷 蒼</p>
                  <p className="text-xs text-slate-500">
                    女性註冊者 · 男性導師
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

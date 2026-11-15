"use client";

import {
  AlertCircle,
  CircleCheck,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { Gender, PublicUser, UserRole } from "@/types/domain";

const PRIMARY_ADMIN_EMAIL = "pricewu168@gmail.com";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)]";
const EYEBROW_CLASS =
  "text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600";
const SECTION_TITLE_CLASS =
  "flex items-center gap-2 text-sm font-semibold text-slate-900";
const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const REVOKE_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const ADMIN_CHIP_CLASS =
  "flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3";
const PRIMARY_BADGE_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700";
const FORM_CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5";
const HINT_CLASS = "mt-1 text-xs text-slate-500";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "管理員",
  user: "一般使用者",
};

type FeedbackTone = "success" | "error";

interface Feedback {
  tone: FeedbackTone;
  message: string;
}

interface AdminAccessPanelProps {
  users: PublicUser[];
  onChanged: () => Promise<void>;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isPrimaryAdmin(email: string): boolean {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

function getDisplayName(target: PublicUser): string {
  const name = target.name.trim();
  return name === "" ? target.email : name;
}

function getInitial(target: PublicUser): string {
  const first = Array.from(getDisplayName(target))[0];
  return typeof first === "string" ? first.toUpperCase() : "?";
}

function toUserRole(value: string): UserRole {
  return value === "admin" ? "admin" : "user";
}

function toGender(value: string): Gender {
  return value === "female" ? "female" : "male";
}

function describeAccessIssue(status: number): string | null {
  if (status === 401) {
    return "登入狀態已失效，請重新登入。";
  }

  if (status === 403) {
    return "您沒有管理員權限。";
  }

  return null;
}

async function readApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (payload !== null && typeof payload === "object" && "error" in payload) {
      const message = (payload as { error?: unknown }).error;

      if (typeof message === "string" && message.trim() !== "") {
        return message;
      }
    }

    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function requestRoleChange(
  email: string,
  role: UserRole,
): Promise<string | null> {
  try {
    const response = await fetch("/api/admin/overview", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ email, role }),
    });

    if (response.ok) {
      return null;
    }

    const accessIssue = describeAccessIssue(response.status);

    if (accessIssue !== null) {
      return accessIssue;
    }

    if (response.status === 404) {
      return "找不到此 email 的帳號";
    }

    if (response.status === 400) {
      const detail = await readApiError(response, "");

      return /primary admin/i.test(detail)
        ? "預設管理員帳號不可被降級或刪除。"
        : "無法更新權限，請確認 email 與角色是否正確。";
    }

    return await readApiError(response, "無法更新權限，請稍後再試。");
  } catch {
    return "無法連線至伺服器，操作未完成，請重試。";
  }
}

function FeedbackNote({ feedback }: { feedback: Feedback | null }) {
  if (feedback === null) {
    return null;
  }

  const isError = feedback.tone === "error";
  const Icon = isError ? AlertCircle : CircleCheck;

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{feedback.message}</span>
    </p>
  );
}

export default function AdminAccessPanel({
  users,
  onChanged,
}: AdminAccessPanelProps) {
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState<UserRole>("admin");
  const [assignFeedback, setAssignFeedback] = useState<Feedback | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newGender, setNewGender] = useState<Gender>("male");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState<Feedback | null>(null);

  const adminUsers = useMemo(() => {
    return users
      .filter((target) => target.role === "admin")
      .slice()
      .sort((left, right) => {
        if (isPrimaryAdmin(left.email)) {
          return -1;
        }

        if (isPrimaryAdmin(right.email)) {
          return 1;
        }

        return left.email.localeCompare(right.email);
      });
  }, [users]);

  const isBusy = isAssigning || isCreating || revokingEmail !== null;

  async function refreshOverview(): Promise<string | null> {
    try {
      await onChanged();
      return null;
    } catch {
      return "資料已更新，但名單重新載入失敗，請重新整理頁面。";
    }
  }

  async function handleAssignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const email = normalizeEmail(assignEmail);

    if (email === "") {
      setAssignFeedback({ tone: "error", message: "請輸入要指派的 email 帳號。" });
      return;
    }

    if (isPrimaryAdmin(email) && assignRole !== "admin") {
      setAssignFeedback({
        tone: "error",
        message: "預設管理員帳號不可被降級或刪除。",
      });
      return;
    }

    setIsAssigning(true);
    setAssignFeedback(null);

    const error = await requestRoleChange(email, assignRole);

    if (error !== null) {
      setAssignFeedback({ tone: "error", message: error });
      setIsAssigning(false);
      return;
    }

    const refreshError = await refreshOverview();

    if (refreshError !== null) {
      setAssignFeedback({ tone: "error", message: refreshError });
    } else {
      setAssignFeedback({
        tone: "success",
        message: `已將 ${email} 設為${ROLE_LABEL[assignRole]}。`,
      });
      setAssignEmail("");
    }

    setIsAssigning(false);
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const name = newName.trim();
    const email = normalizeEmail(newEmail);

    if (name === "") {
      setCreateFeedback({ tone: "error", message: "請輸入姓名。" });
      return;
    }

    if (email === "") {
      setCreateFeedback({ tone: "error", message: "請輸入 email。" });
      return;
    }

    if (newPassword.length < 6) {
      setCreateFeedback({ tone: "error", message: "密碼至少需要 6 個字元。" });
      return;
    }

    setIsCreating(true);
    setCreateFeedback(null);

    let failure: string | null = null;

    try {
      const response = await fetch("/api/admin/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          email,
          password: newPassword,
          gender: newGender,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const accessIssue = describeAccessIssue(response.status);

        if (accessIssue !== null) {
          failure = accessIssue;
        } else if (response.status === 409) {
          failure = "此 email 已註冊";
        } else if (response.status === 400) {
          failure =
            "帳號資料格式有誤，請確認姓名、email、密碼（6–128 個字元）、性別與角色。";
        } else {
          failure = await readApiError(response, "無法建立帳號，請稍後再試。");
        }
      }
    } catch {
      failure = "無法連線至伺服器，帳號未建立，請重試。";
    }

    if (failure !== null) {
      setCreateFeedback({ tone: "error", message: failure });
      setIsCreating(false);
      return;
    }

    const refreshError = await refreshOverview();

    if (refreshError !== null) {
      setCreateFeedback({ tone: "error", message: refreshError });
    } else {
      setCreateFeedback({
        tone: "success",
        message: `已建立 ${email}（${ROLE_LABEL[newRole]}）。`,
      });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewGender("male");
      setNewRole("user");
    }

    setIsCreating(false);
  }

  async function handleRevoke(target: PublicUser) {
    if (isBusy) {
      return;
    }

    const email = normalizeEmail(target.email);
    const confirmed = window.confirm(
      `確定要撤回「${getDisplayName(target)}」（${email}）的管理員權限嗎？`,
    );

    if (!confirmed) {
      return;
    }

    setRevokingEmail(email);
    setListFeedback(null);

    const error = await requestRoleChange(email, "user");

    if (error !== null) {
      setListFeedback({ tone: "error", message: error });
      setRevokingEmail(null);
      return;
    }

    const refreshError = await refreshOverview();

    if (refreshError !== null) {
      setListFeedback({ tone: "error", message: refreshError });
    } else {
      setListFeedback({
        tone: "success",
        message: `已撤回 ${email} 的管理員權限。`,
      });
    }

    setRevokingEmail(null);
  }

  return (
    <section aria-labelledby="admin-access-title" className={CARD_CLASS}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={EYEBROW_CLASS}>Accounts &amp; permissions</p>
          <h2
            id="admin-access-title"
            className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-indigo-600" />
            帳號與權限管理
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            以 email 指派管理員權限，或直接建立新的平台帳號。
          </p>
        </div>

        {isBusy ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            處理中
          </span>
        ) : null}
      </header>

      <div className="mt-6 space-y-6">
        <div>
          <h3 className={SECTION_TITLE_CLASS}>
            <Users aria-hidden="true" className="h-4 w-4 text-indigo-600" />
            目前管理員名單
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {adminUsers.length}
            </span>
          </h3>
          <p className={HINT_CLASS}>
            預設管理員 {PRIMARY_ADMIN_EMAIL} 的角色無法被撤回。
          </p>

          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {adminUsers.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 lg:col-span-2">
                目前尚無管理員資料。
              </li>
            ) : (
              adminUsers.map((target) => {
                const primary = isPrimaryAdmin(target.email);
                const revoking = revokingEmail === normalizeEmail(target.email);

                return (
                  <li key={target.id} className={ADMIN_CHIP_CLASS}>
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
                    >
                      {getInitial(target)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {getDisplayName(target)}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {target.email}
                      </span>
                    </span>
                    {primary ? (
                      <span className={PRIMARY_BADGE_CLASS}>
                        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                        預設管理員
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={REVOKE_BUTTON_CLASS}
                        onClick={() => {
                          void handleRevoke(target);
                        }}
                        disabled={isBusy}
                        aria-label={`撤回 ${target.email} 的管理員權限`}
                      >
                        {revoking ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin"
                          />
                        ) : (
                          <ShieldOff aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        撤回管理員
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          <FeedbackNote feedback={listFeedback} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <form
            onSubmit={(event) => {
              void handleAssignSubmit(event);
            }}
            className={FORM_CARD_CLASS}
            aria-busy={isAssigning}
          >
            <h3 className={SECTION_TITLE_CLASS}>
              <ShieldPlus aria-hidden="true" className="h-4 w-4 text-indigo-600" />
              以 Email 指派權限
            </h3>
            <p className={HINT_CLASS}>需為已註冊的帳號，email 必須完全相符。</p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="admin-assign-email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="admin-assign-email"
                  type="email"
                  className={INPUT_CLASS}
                  value={assignEmail}
                  onChange={(event) => setAssignEmail(event.target.value)}
                  placeholder="user@example.com"
                  autoComplete="email"
                  required
                  disabled={isBusy}
                />
              </div>

              <div>
                <label htmlFor="admin-assign-role" className={LABEL_CLASS}>
                  角色
                </label>
                <select
                  id="admin-assign-role"
                  className={INPUT_CLASS}
                  value={assignRole}
                  onChange={(event) => setAssignRole(toUserRole(event.target.value))}
                  disabled={isBusy}
                >
                  <option value="admin">管理員</option>
                  <option value="user">一般使用者</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isBusy}>
                {isAssigning ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail aria-hidden="true" className="h-4 w-4" />
                )}
                更新權限
              </button>
            </div>

            <FeedbackNote feedback={assignFeedback} />
          </form>

          <form
            onSubmit={(event) => {
              void handleCreateSubmit(event);
            }}
            className={FORM_CARD_CLASS}
            aria-busy={isCreating}
          >
            <h3 className={SECTION_TITLE_CLASS}>
              <UserPlus aria-hidden="true" className="h-4 w-4 text-indigo-600" />
              新增帳號
            </h3>
            <p className={HINT_CLASS}>建立後即可直接登入，密碼至少 6 個字元。</p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="admin-create-name" className={LABEL_CLASS}>
                  姓名
                </label>
                <input
                  id="admin-create-name"
                  type="text"
                  className={INPUT_CLASS}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="王小明"
                  autoComplete="name"
                  maxLength={80}
                  required
                  disabled={isBusy}
                />
              </div>

              <div>
                <label htmlFor="admin-create-email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="admin-create-email"
                  type="email"
                  className={INPUT_CLASS}
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="user@example.com"
                  autoComplete="email"
                  required
                  disabled={isBusy}
                />
              </div>

              <div>
                <label htmlFor="admin-create-password" className={LABEL_CLASS}>
                  密碼
                </label>
                <input
                  id="admin-create-password"
                  type="password"
                  className={INPUT_CLASS}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="至少 6 個字元"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  required
                  disabled={isBusy}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-create-gender" className={LABEL_CLASS}>
                    性別
                  </label>
                  <select
                    id="admin-create-gender"
                    className={INPUT_CLASS}
                    value={newGender}
                    onChange={(event) => setNewGender(toGender(event.target.value))}
                    disabled={isBusy}
                  >
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-create-role" className={LABEL_CLASS}>
                    角色
                  </label>
                  <select
                    id="admin-create-role"
                    className={INPUT_CLASS}
                    value={newRole}
                    onChange={(event) => setNewRole(toUserRole(event.target.value))}
                    disabled={isBusy}
                  >
                    <option value="user">一般使用者</option>
                    <option value="admin">管理員</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isBusy}>
                {isCreating ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus aria-hidden="true" className="h-4 w-4" />
                )}
                建立帳號
              </button>
            </div>

            <FeedbackNote feedback={createFeedback} />
          </form>
        </div>
      </div>
    </section>
  );
}

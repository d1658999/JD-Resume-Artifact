"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, ShieldCheck, Sparkles, X } from "lucide-react";

import { notifyAuthChanged, useCurrentUser } from "@/lib/auth-client";

const primaryLinks = [
  { href: "/", label: "首頁" },
  { href: "/workspace", label: "工作台" },
] as const;

const adminLink = { href: "/admin", label: "管理後台" } as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export default function Navbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { status, user, clear } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // The visible session is still cleared if the request fails.
    } finally {
      clear();
      notifyAuthChanged();
      setLoggingOut(false);
      setMenuOpen(false);
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="JD Resume Artifact 首頁"
          className={`group flex shrink-0 items-center gap-2.5 rounded-2xl ${focusRing}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition group-hover:bg-indigo-500">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
              JD Resume Artifact
            </span>
            <span className="truncate text-[10px] font-medium tracking-[0.08em] text-slate-500 sm:text-[11px]">
              雙語求職工作台
            </span>
          </span>
        </Link>

        <nav aria-label="主要導覽" className="hidden items-center gap-1 md:flex">
          {primaryLinks.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${focusRing} ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {user?.role === "admin" ? (
            <Link
              href={adminLink.href}
              aria-current={isActive(adminLink.href) ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${focusRing} ${
                isActive(adminLink.href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {adminLink.label}
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <div className="hidden items-center gap-2 md:flex" role="status">
              <span className="sr-only">正在確認登入狀態</span>
              <span
                aria-hidden="true"
                className="h-9 w-9 animate-pulse rounded-full bg-slate-100"
              />
              <span
                aria-hidden="true"
                className="h-3 w-20 animate-pulse rounded-full bg-slate-100"
              />
            </div>
          ) : user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/workspace"
                aria-label={`${user.name}（${
                  user.role === "admin" ? "管理員" : "會員"
                }）的工作台`}
                className={`flex items-center gap-2 rounded-full border border-slate-200/80 bg-white p-1 pr-2.5 transition hover:border-slate-300 hover:bg-slate-50 ${focusRing}`}
              >
                <Image
                  src={user.mentor.avatarUrl}
                  alt={`${user.mentor.mentorName} 導師頭像`}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <span className="flex max-w-[9rem] flex-col leading-tight">
                  <span className="truncate text-xs font-semibold text-slate-900">
                    {user.name}
                  </span>
                  <span
                    className={`mt-0.5 w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      user.role === "admin"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {user.role === "admin" ? "管理員" : "會員"}
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="登出"
                title="登出"
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <LogOut
                  className={`h-4 w-4 ${loggingOut ? "animate-pulse" : ""}`}
                  aria-hidden="true"
                />
                <span>{loggingOut ? "登出中…" : "登出"}</span>
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className={`btn-secondary ${focusRing}`}>
                登入
              </Link>
              <Link href="/register" className={`btn-primary ${focusRing}`}>
                免費註冊
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "關閉選單" : "開啟選單"}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 md:hidden ${focusRing}`}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-b border-slate-200/80 bg-white/95 shadow-[0_28px_60px_-35px_rgba(15,23,42,0.4)] backdrop-blur-xl md:hidden"
        >
          <nav aria-label="行動版主要導覽" className="shell flex flex-col gap-1 py-4">
            {primaryLinks.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${focusRing} ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-slate-400">
                    →
                  </span>
                </Link>
              );
            })}

            {user?.role === "admin" ? (
              <Link
                href={adminLink.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(adminLink.href) ? "page" : undefined}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${focusRing} ${
                  isActive(adminLink.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {adminLink.label}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  →
                </span>
              </Link>
            ) : null}
          </nav>

          <div className="shell border-t border-slate-200/80 py-4">
            {status === "loading" ? (
              <div
                role="status"
                className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                <span className="text-sm text-slate-500">正在確認登入狀態…</span>
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
                  <Image
                    src={user.mentor.avatarUrl}
                    alt={`${user.mentor.mentorName} 導師頭像`}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      user.role === "admin"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {user.role === "admin" ? "管理員" : "會員"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={`btn-secondary w-full ${focusRing}`}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {loggingOut ? "登出中…" : "登出"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className={`btn-secondary w-full ${focusRing}`}
                >
                  登入
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className={`btn-primary w-full ${focusRing}`}
                >
                  免費註冊
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

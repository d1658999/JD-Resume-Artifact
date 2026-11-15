"use client";

import Link from "next/link";

import { useCurrentUser } from "@/lib/auth-client";

const linkClassName =
  "rounded transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2";

export default function FooterAuthLinks() {
  const { status, user } = useCurrentUser();
  const isAuthenticated = status === "ready" && user !== null;

  return (
    <nav
      aria-label="頁尾導覽"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-slate-600"
    >
      <Link href="/" className={linkClassName}>
        首頁
      </Link>
      <Link href="/workspace" className={linkClassName}>
        工作台
      </Link>
      {isAuthenticated ? null : (
        <>
          <Link href="/login" className={linkClassName}>
            登入
          </Link>
          <Link href="/register" className={linkClassName}>
            註冊
          </Link>
        </>
      )}
      {user?.role === "admin" ? (
        <Link href="/admin" className={linkClassName}>
          管理後台
        </Link>
      ) : null}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useCurrentUser } from "@/lib/auth-client";

interface AuthAwareCtaProps {
  className?: string;
  guestLabel?: string;
  userLabel?: string;
  showArrow?: boolean;
}

export default function AuthAwareCta({
  className,
  guestLabel = "免費註冊",
  userLabel = "進入工作台",
  showArrow = false,
}: AuthAwareCtaProps) {
  const { status, user } = useCurrentUser();
  const isAuthenticated = status === "ready" && user !== null;

  return (
    <Link href={isAuthenticated ? "/workspace" : "/register"} className={className}>
      {isAuthenticated ? userLabel : guestLabel}
      {showArrow ? (
        <ArrowRight
          className="h-4 w-4 transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}

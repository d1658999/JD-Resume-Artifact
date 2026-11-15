import { NextResponse } from "next/server";

import { COOKIE_NAME, buildSessionCookieOptions } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  try {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set(COOKIE_NAME, "", {
      ...buildSessionCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "POST /api/auth/logout failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

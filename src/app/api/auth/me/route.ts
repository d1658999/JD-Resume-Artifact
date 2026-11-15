import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel, toPublicUser } from "@/models/User";

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

async function getCurrentUser(): Promise<NextResponse> {
  const session = await getSessionFromCookies();

  if (!session || !OBJECT_ID_PATTERN.test(session.userId)) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await connectToDatabase();

  const user = await UserModel.findById(session.userId);

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ user: toPublicUser(user) }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error(
      "GET /api/auth/me failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

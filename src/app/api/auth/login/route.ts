import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  COOKIE_NAME,
  buildSessionCookieOptions,
  determineUserRole,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel, toPublicUser } from "@/models/User";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});

const INVALID_CREDENTIALS_ERROR = "Invalid email or password.";

async function login(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  await connectToDatabase();

  const user = await UserModel.findOne({ email });
  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_ERROR },
      { status: 401 },
    );
  }

  if (determineUserRole(user.email) === "admin" && user.role !== "admin") {
    user.role = "admin";
    await user.save();
  }

  const publicUser = toPublicUser(user);
  const token = await signSessionToken({
    userId: publicUser.id,
    email: publicUser.email,
    role: publicUser.role,
    gender: publicUser.gender,
    name: publicUser.name,
  });

  const response = NextResponse.json({ user: publicUser }, { status: 200 });
  response.cookies.set(COOKIE_NAME, token, buildSessionCookieOptions());

  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await login(request);
  } catch (error) {
    console.error(
      "POST /api/auth/login failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  COOKIE_NAME,
  REGISTRATION_CAPTCHA,
  buildSessionCookieOptions,
  determineUserRole,
  hashPassword,
  signSessionToken,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { UserModel, toPublicUser } from "@/models/User";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(80),
  gender: z.enum(["male", "female"]),
  captcha: z.string(),
});

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function register(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration payload." },
      { status: 400 },
    );
  }

  const { email, password, name, gender, captcha } = parsed.data;

  if (captcha !== REGISTRATION_CAPTCHA) {
    return NextResponse.json({ error: "Invalid captcha." }, { status: 400 });
  }

  await connectToDatabase();

  const existingUser = await UserModel.findOne({ email }).lean();

  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await UserModel.create({
      email,
      passwordHash,
      name,
      gender,
      role: determineUserRole(email),
    });

    const publicUser = toPublicUser(user);
    const token = await signSessionToken({
      userId: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
      gender: publicUser.gender,
      name: publicUser.name,
    });

    const response = NextResponse.json({ user: publicUser }, { status: 201 });
    response.cookies.set(COOKIE_NAME, token, buildSessionCookieOptions());

    return response;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await register(request);
  } catch (error) {
    console.error(
      "POST /api/auth/register failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

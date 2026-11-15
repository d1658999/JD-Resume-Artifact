import { createHash } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import type { Gender, MentorProfile, SessionPayload, UserRole } from "@/types/domain";

export const ADMIN_EMAIL = "pricewu168@gmail.com";
export const REGISTRATION_CAPTCHA = "job888";
export const COOKIE_NAME = "jd_artifact_session";
export const COOKIE_MAX_AGE_SECONDS = 86400;

const textEncoder = new TextEncoder();

const MALE_REGISTERED_MENTOR: MentorProfile = {
  mentorGender: "female",
  mentorName: "星野 凜 (Rin Hoshino)",
  mentorTitle: "資深職涯導師 Senior Career Mentor",
  avatarUrl: "/avatars/mentor-female.jpg",
  greetingZh: "你好，我是星野 凜。讓我們一起分析這份職缺，打造能脫穎而出的履歷吧！",
  greetingEn:
    "Hi, I'm Rin Hoshino. Let's analyze this role together and craft a resume that stands out!",
};

const FEMALE_REGISTERED_MENTOR: MentorProfile = {
  mentorGender: "male",
  mentorName: "神谷 蒼 (Ao Kamiya)",
  mentorTitle: "資深職涯導師 Senior Career Mentor",
  avatarUrl: "/avatars/mentor-male.jpg",
  greetingZh: "你好，我是神谷 蒼。我會協助你拆解職缺需求，並準備好面試與筆試。",
  greetingEn:
    "Hi, I'm Ao Kamiya. I'll help you break down the job requirements and prepare for interviews and written tests.",
};

function resolveSessionSecret(): string {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret) {
    return jwtSecret;
  }

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (mongoUri) {
    return createHash("sha256").update(mongoUri).digest("hex");
  }

  throw new Error(
    "Missing auth configuration: set JWT_SECRET (preferred) or MONGODB_URI so session tokens can be signed and verified.",
  );
}

function getSessionSecretKey(): Uint8Array {
  return textEncoder.encode(resolveSessionSecret());
}

function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin";
}

function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female";
}

export function determineUserRole(email: string): UserRole {
  return email.trim().toLowerCase() === ADMIN_EMAIL ? "admin" : "user";
}

export function getMentorProfile(gender: Gender): MentorProfile {
  switch (gender) {
    case "male":
      return { ...MALE_REGISTERED_MENTOR };
    case "female":
      return { ...FEMALE_REGISTERED_MENTOR };
    default: {
      const unexpectedGender: never = gender;
      throw new Error(`Unsupported gender: ${String(unexpectedGender)}`);
    }
  }
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}

export function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    gender: payload.gender,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSessionSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const secretKey = getSessionSecretKey();

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    const { userId, email, role, gender, name } = payload;

    if (
      typeof userId !== "string" ||
      typeof email !== "string" ||
      typeof name !== "string" ||
      !isUserRole(role) ||
      !isGender(gender)
    ) {
      return null;
    }

    return { userId, email, role, gender, name };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export function buildSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

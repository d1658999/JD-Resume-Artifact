import { decodeJwt } from "jose";
import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as adminOverviewRoute } from "@/app/api/admin/overview/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import {
  ADMIN_EMAIL,
  COOKIE_NAME,
  hashPassword,
  verifySessionToken,
} from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  getSessionFromCookies: vi.fn(),
  connectToDatabase: vi.fn(),
  userFindOne: vi.fn(),
  userFindById: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  userExists: vi.fn(),
  artifactFind: vi.fn(),
  artifactFindOne: vi.fn(),
  artifactCreate: vi.fn(),
  artifactFindOneAndUpdate: vi.fn(),
  artifactDeleteOne: vi.fn(),
  artifactDeleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();

  return {
    ...actual,
    getSessionFromCookies: mocks.getSessionFromCookies,
  };
});

vi.mock("@/models/User", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/User")>();

  return {
    ...actual,
    UserModel: {
      findOne: mocks.userFindOne,
      findById: mocks.userFindById,
      find: mocks.userFind,
      create: mocks.userCreate,
      exists: mocks.userExists,
    },
  };
});

vi.mock("@/models/ArtifactRecord", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/models/ArtifactRecord")>();

  return {
    ...actual,
    ArtifactRecordModel: {
      find: mocks.artifactFind,
      findOne: mocks.artifactFindOne,
      create: mocks.artifactCreate,
      findOneAndUpdate: mocks.artifactFindOneAndUpdate,
      deleteOne: mocks.artifactDeleteOne,
      deleteMany: mocks.artifactDeleteMany,
    },
  };
});

process.env.JWT_SECRET = "vitest-session-secret";

const VALID_USER_ID = "64b7f0c2f1a2b3c4d5e6f7a8";

interface LeanQuery<T> extends Promise<T> {
  lean: () => Promise<T>;
  select: (projection?: string) => LeanQuery<T>;
  sort: (sort?: Record<string, 1 | -1>) => LeanQuery<T>;
  limit: (limit?: number) => LeanQuery<T>;
}

function makeQuery<T>(value: T): LeanQuery<T> {
  const query = Promise.resolve(value) as LeanQuery<T>;
  query.lean = () => Promise.resolve(value);
  query.select = () => query;
  query.sort = () => query;
  query.limit = () => query;
  return query;
}

interface FakeUserInput {
  email: string;
  passwordHash: string;
  name: string;
  gender: "male" | "female";
  role: "user" | "admin";
}

interface FakeUserDocument {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  gender: "male" | "female";
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

function makeUserDocument(input: FakeUserInput): FakeUserDocument {
  return {
    _id: new Types.ObjectId(),
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    gender: input.gender,
    role: input.role,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = new RegExp(`${COOKIE_NAME}=([^;]+)`).exec(setCookie);

  if (!match?.[1]) {
    throw new Error("Session cookie was not set.");
  }

  return decodeURIComponent(match[1]);
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getSessionFromCookies.mockReset().mockResolvedValue(null);
  mocks.connectToDatabase.mockReset().mockResolvedValue(undefined);
  mocks.userFindOne.mockReset().mockReturnValue(makeQuery(null));
  mocks.userFindById.mockReset();
  mocks.userFind.mockReset();
  mocks.userCreate
    .mockReset()
    .mockImplementation(async (input: FakeUserInput) =>
      makeUserDocument(input),
    );
  mocks.userExists.mockReset().mockResolvedValue(null);
  mocks.artifactFind.mockReset();
  mocks.artifactFindOne.mockReset();
  mocks.artifactCreate.mockReset();
  mocks.artifactFindOneAndUpdate.mockReset();
  mocks.artifactDeleteOne.mockReset();
  mocks.artifactDeleteMany.mockReset();
});

describe("POST /api/auth/register", () => {
  it("rejects a captcha other than job888 without creating a user", async () => {
    const response = await registerRoute(
      jsonRequest("/api/auth/register", {
        email: "blocked@example.com",
        password: "password123",
        name: "Blocked User",
        gender: "male",
        captcha: "wrong-code",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("registers with job888 and returns a 1-day HTTP-only JWT cookie", async () => {
    const response = await registerRoute(
      jsonRequest("/api/auth/register", {
        email: "New.Candidate@Example.com",
        password: "strong-password",
        name: "New Candidate",
        gender: "male",
        captcha: "job888",
      }),
    );

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      user: {
        email: string;
        role: string;
        mentor: { avatarUrl: string };
      };
    };

    expect(body.user.email).toBe("new.candidate@example.com");
    expect(body.user.role).toBe("user");
    expect(body.user.mentor.avatarUrl).toBe("/avatars/mentor-female.jpg");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("max-age=86400");
    expect(setCookie.toLowerCase()).toContain("path=/");

    const token = readSessionCookie(response);
    const session = await verifySessionToken(token);
    expect(session?.email).toBe("new.candidate@example.com");

    const decoded = decodeJwt(token);
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(86400);
  });

  it("assigns the admin role only to pricewu168@gmail.com", async () => {
    const response = await registerRoute(
      jsonRequest("/api/auth/register", {
        email: " PriceWu168@Gmail.com ",
        password: "strong-password",
        name: "Primary Admin",
        gender: "female",
        captcha: "job888",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: ADMIN_EMAIL, role: "admin" }),
    );

    const body = (await response.json()) as {
      user: { role: string; mentor: { avatarUrl: string } };
    };
    expect(body.user.role).toBe("admin");
    expect(body.user.mentor.avatarUrl).toBe("/avatars/mentor-male.jpg");
  });

  it("rejects a password shorter than 6 characters", async () => {
    const response = await registerRoute(
      jsonRequest("/api/auth/register", {
        email: "short-password@example.com",
        password: "12345",
        name: "Short Password",
        gender: "male",
        captcha: "job888",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate email", async () => {
    mocks.userFindOne.mockReturnValue(
      makeQuery(
        makeUserDocument({
          email: "duplicate@example.com",
          passwordHash: "hash",
          name: "Duplicate",
          gender: "male",
          role: "user",
        }),
      ),
    );

    const response = await registerRoute(
      jsonRequest("/api/auth/register", {
        email: "duplicate@example.com",
        password: "strong-password",
        name: "Duplicate",
        gender: "male",
        captcha: "job888",
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("verifies a bcrypt password and refreshes the 1-day session cookie", async () => {
    const passwordHash = await hashPassword("correct-password");
    mocks.userFindOne.mockReturnValue(
      makeQuery(
        makeUserDocument({
          email: "login@example.com",
          passwordHash,
          name: "Login User",
          gender: "female",
          role: "user",
        }),
      ),
    );

    const response = await loginRoute(
      jsonRequest("/api/auth/login", {
        email: "login@example.com",
        password: "correct-password",
      }),
    );

    expect(response.status).toBe(200);
    const token = readSessionCookie(response);
    const session = await verifySessionToken(token);
    expect(session).toMatchObject({
      email: "login@example.com",
      gender: "female",
      role: "user",
    });
  });

  it("rejects an incorrect password with 401", async () => {
    const passwordHash = await hashPassword("correct-password");
    mocks.userFindOne.mockReturnValue(
      makeQuery(
        makeUserDocument({
          email: "login@example.com",
          passwordHash,
          name: "Login User",
          gender: "female",
          role: "user",
        }),
      ),
    );

    const response = await loginRoute(
      jsonRequest("/api/auth/login", {
        email: "login@example.com",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the one-day session cookie", async () => {
    const response = await logoutRoute();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });
});

describe("authorization guards", () => {
  it("returns 401 from /api/auth/me without a session", async () => {
    const response = await meRoute();
    expect(response.status).toBe(401);
  });

  it("returns 403 from /api/admin/overview for a non-admin user", async () => {
    mocks.getSessionFromCookies.mockResolvedValue({
      userId: VALID_USER_ID,
      email: "member@example.com",
      role: "user",
      gender: "male",
      name: "Member",
    });
    mocks.userFindById.mockReturnValue(makeQuery({ role: "user" }));

    const response = await adminOverviewRoute();

    expect(response.status).toBe(403);
    expect(mocks.artifactFind).not.toHaveBeenCalled();
  });

  it("returns admin statistics for an admin user", async () => {
    const adminUser = makeUserDocument({
      email: ADMIN_EMAIL,
      passwordHash: "hash",
      name: "Primary Admin",
      gender: "female",
      role: "admin",
    });

    mocks.getSessionFromCookies.mockResolvedValue({
      userId: adminUser._id.toString(),
      email: ADMIN_EMAIL,
      role: "admin",
      gender: "female",
      name: "Primary Admin",
    });
    mocks.userFindById.mockReturnValue(makeQuery({ role: "admin" }));
    mocks.userFind.mockReturnValue(makeQuery([adminUser]));
    mocks.artifactFind.mockReturnValue(
      makeQuery([
        {
          _id: new Types.ObjectId(),
          userId: adminUser._id,
          userEmail: ADMIN_EMAIL,
          jdUrl: "https://example.com/jobs/1",
          jdTitle: "Senior Engineer",
          aiProvider: "openai",
          aiModel: "gpt-6-luna",
          resumeSourceType: "pdf",
          resumeFileName: "resume.pdf",
          resumeBlobUrl: "https://blob.example.com/resume.pdf",
          resumeSourceUrl: null,
          jdAnalysis: null,
          resumeReview: null,
          interviewQuestions: null,
          jdRawText: "Job description",
          resumeExtractedText: "Resume text",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]),
    );

    const response = await adminOverviewRoute();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      stats: {
        totalUsers: number;
        totalRecords: number;
        totalResumesWithBlob: number;
      };
      users: unknown[];
      records: unknown[];
    };

    expect(body.stats).toEqual({
      totalUsers: 1,
      totalRecords: 1,
      totalResumesWithBlob: 1,
    });
    expect(body.users).toHaveLength(1);
    expect(body.records).toHaveLength(1);
  });
});

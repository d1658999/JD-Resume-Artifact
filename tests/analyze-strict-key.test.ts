import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Mock, MockInstance } from "vitest";

import { POST as analyzeInterviewRoute } from "@/app/api/analyze/interview/route";
import { POST as analyzeJdRoute } from "@/app/api/analyze/jd/route";
import { POST as analyzeResumeRoute } from "@/app/api/analyze/resume/route";

import type { SessionPayload } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getSessionFromCookies: vi.fn(),
  connectToDatabase: vi.fn(),
  artifactFindOne: vi.fn(),
  artifactCreate: vi.fn(),
  artifactFindOneAndUpdate: vi.fn(),
  analyzeJobDescription: vi.fn(),
  reviewResumeAgainstJd: vi.fn(),
  generateInterviewQuestions: vi.fn(),
}));

const originalEnv = vi.hoisted(() => {
  const snapshot = {
    JWT_SECRET: process.env.JWT_SECRET,
    openai_key: process.env.openai_key,
    gemini_key: process.env.gemini_key,
    ollama_key: process.env.ollama_key,
  };

  process.env.JWT_SECRET = "vitest-session-secret";
  process.env.openai_key = "env-secret";
  process.env.gemini_key = "env-secret";
  process.env.ollama_key = "env-secret";

  return snapshot;
});

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

vi.mock("@/models/ArtifactRecord", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/models/ArtifactRecord")>();

  return {
    ...actual,
    ArtifactRecordModel: {
      findOne: mocks.artifactFindOne,
      create: mocks.artifactCreate,
      findOneAndUpdate: mocks.artifactFindOneAndUpdate,
    },
  };
});

vi.mock("@/lib/ai-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-client")>();

  return {
    ...actual,
    analyzeJobDescription: mocks.analyzeJobDescription,
    reviewResumeAgainstJd: mocks.reviewResumeAgainstJd,
    generateInterviewQuestions: mocks.generateInterviewQuestions,
  };
});

const SESSION_PAYLOAD: SessionPayload = {
  userId: "64b7f0c2f1a2b3c4d5e6f7a8",
  email: "user@example.com",
  role: "user",
  gender: "male",
  name: "Test User",
};

interface AnalyzeRouteCase {
  path: string;
  handler: (request: Request) => Promise<Response>;
  body: Record<string, unknown>;
  aiClientMock: Mock;
}

const ROUTE_CASES: AnalyzeRouteCase[] = [
  {
    path: "/api/analyze/jd",
    handler: analyzeJdRoute,
    body: { jdFallbackText: "Senior engineer role", provider: "openai" },
    aiClientMock: mocks.analyzeJobDescription,
  },
  {
    path: "/api/analyze/resume",
    handler: analyzeResumeRoute,
    body: {
      jdFallbackText: "Senior engineer role",
      resumeText: "Resume text",
      provider: "openai",
    },
    aiClientMock: mocks.reviewResumeAgainstJd,
  },
  {
    path: "/api/analyze/interview",
    handler: analyzeInterviewRoute,
    body: { jdFallbackText: "Senior engineer role", provider: "openai" },
    aiClientMock: mocks.generateInterviewQuestions,
  },
];

let fetchSpy!: MockInstance<typeof fetch>;

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function applyStrictKeyEnv(): void {
  process.env.JWT_SECRET = "vitest-session-secret";
  process.env.openai_key = "env-secret";
  process.env.gemini_key = "env-secret";
  process.env.ollama_key = "env-secret";
}

function buildBody(
  body: Record<string, unknown>,
  apiKey: string | undefined,
): Record<string, unknown> {
  return apiKey === undefined ? body : { ...body, apiKey };
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" ? error : "";
}

async function postAnalyze(
  routeCase: AnalyzeRouteCase,
  apiKey: string | undefined,
): Promise<Response> {
  return routeCase.handler(
    new Request(`http://localhost${routeCase.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(routeCase.body, apiKey)),
    }),
  );
}

async function expectApiKeyRejection(
  routeCase: AnalyzeRouteCase,
  apiKey: string | undefined,
): Promise<void> {
  const response = await postAnalyze(routeCase, apiKey);
  const errorMessage = readErrorMessage(await response.json());

  expect(response.status).toBe(400);
  expect(errorMessage).toMatch(/api[\s_-]?key/i);
  if (apiKey !== undefined) {
    expect(errorMessage).toContain(
      "Missing API key. You must provide your own API key.",
    );
  }
  expect(errorMessage).not.toContain("env-secret");
  expect(routeCase.aiClientMock).not.toHaveBeenCalled();
  expect(mocks.connectToDatabase).not.toHaveBeenCalled();
  expect(mocks.artifactFindOne).not.toHaveBeenCalled();
  expect(mocks.artifactCreate).not.toHaveBeenCalled();
  expect(mocks.artifactFindOneAndUpdate).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();

  applyStrictKeyEnv();

  mocks.getSessionFromCookies.mockReset().mockResolvedValue(SESSION_PAYLOAD);
  mocks.connectToDatabase.mockReset().mockResolvedValue(undefined);
  mocks.artifactFindOne.mockReset().mockResolvedValue(null);
  mocks.artifactCreate.mockReset().mockResolvedValue(null);
  mocks.artifactFindOneAndUpdate.mockReset().mockResolvedValue(null);
  mocks.analyzeJobDescription.mockReset();
  mocks.reviewResumeAgainstJd.mockReset();
  mocks.generateInterviewQuestions.mockReset();

  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("fetch must not run when the user API key is missing.");
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  restoreEnvVar("JWT_SECRET", originalEnv.JWT_SECRET);
  restoreEnvVar("openai_key", originalEnv.openai_key);
  restoreEnvVar("gemini_key", originalEnv.gemini_key);
  restoreEnvVar("ollama_key", originalEnv.ollama_key);
});

describe("analyze routes require a user-supplied API key", () => {
  for (const routeCase of ROUTE_CASES) {
    describe(`POST ${routeCase.path}`, () => {
      it("rejects an omitted apiKey instead of using environment variables", async () => {
        await expectApiKeyRejection(routeCase, undefined);
      });

      it("rejects a blank or whitespace apiKey instead of using environment variables", async () => {
        for (const apiKey of ["", "   "]) {
          await expectApiKeyRejection(routeCase, apiKey);
        }
      });
    });
  }
});

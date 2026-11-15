import { SignJWT, decodeJwt } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_MODEL_CONFIG,
  AiClientError,
  extractJsonObject,
  generateInterviewQuestions,
  resolveAiApiKey,
} from "@/lib/ai-client";
import {
  ADMIN_EMAIL,
  COOKIE_MAX_AGE_SECONDS,
  COOKIE_NAME,
  REGISTRATION_CAPTCHA,
  buildSessionCookieOptions,
  determineUserRole,
  getMentorProfile,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";

import type { SessionPayload } from "@/types/domain";

process.env.JWT_SECRET = "vitest-session-secret";

const SESSION_PAYLOAD: SessionPayload = {
  userId: "64b7f0c2f1a2b3c4d5e6f7a8",
  email: "candidate@example.com",
  role: "user",
  gender: "male",
  name: "Candidate",
};

const QUESTION_TYPES = [
  "technical",
  "behavioral",
  "system_design",
  "written_test",
] as const;

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function buildQuestion(index: number): Record<string, unknown> {
  return {
    type: QUESTION_TYPES[index % QUESTION_TYPES.length],
    difficulty: DIFFICULTIES[index % DIFFICULTIES.length],
    question: { zh: `問題 ${index + 1}`, en: `Question ${index + 1}` },
    testingFocus: { zh: `測試重點 ${index + 1}`, en: `Focus ${index + 1}` },
    referenceAnswerPoints: {
      zh: ["要點一", "要點二", "要點三"],
      en: ["Point one", "Point two", "Point three"],
    },
  };
}

function buildOpenAiResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function buildGeminiResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: JSON.stringify(content) }] } },
      ],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function captureAiClientError(run: () => unknown): AiClientError {
  try {
    run();
  } catch (error) {
    if (error instanceof AiClientError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected an AiClientError to be thrown, but none was.");
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("frozen auth rules", () => {
  it("uses the frozen captcha, cookie name, and one-day session length", () => {
    expect(REGISTRATION_CAPTCHA).toBe("job888");
    expect(COOKIE_NAME).toBe("jd_artifact_session");
    expect(COOKIE_MAX_AGE_SECONDS).toBe(86400);
    expect(ADMIN_EMAIL).toBe("pricewu168@gmail.com");
  });

  it("grants the admin role only to pricewu168@gmail.com", () => {
    expect(determineUserRole("pricewu168@gmail.com")).toBe("admin");
    expect(determineUserRole(" PriceWu168@Gmail.com ")).toBe("admin");
    expect(determineUserRole("pricewu168@gmail.com.evil.test")).toBe("user");
    expect(determineUserRole("other@example.com")).toBe("user");
  });

  it("gender-swaps the Japanese 2D anime mentor", () => {
    const maleRegistrantMentor = getMentorProfile("male");
    expect(maleRegistrantMentor.mentorGender).toBe("female");
    expect(maleRegistrantMentor.avatarUrl).toBe("/avatars/mentor-female.jpg");
    expect(maleRegistrantMentor.mentorName).toContain("星野 凜");

    const femaleRegistrantMentor = getMentorProfile("female");
    expect(femaleRegistrantMentor.mentorGender).toBe("male");
    expect(femaleRegistrantMentor.avatarUrl).toBe("/avatars/mentor-male.jpg");
    expect(femaleRegistrantMentor.mentorName).toContain("神谷 蒼");
  });

  it("hashes passwords with bcrypt and verifies them", async () => {
    const passwordHash = await hashPassword("correct-horse-battery");

    expect(passwordHash).not.toBe("correct-horse-battery");
    expect(passwordHash.startsWith("$2")).toBe(true);
    await expect(
      verifyPassword("correct-horse-battery", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(
      false,
    );
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("signs a verifiable HS256 session JWT that expires in 24 hours", async () => {
    const token = await signSessionToken(SESSION_PAYLOAD);

    await expect(verifySessionToken(token)).resolves.toEqual(SESSION_PAYLOAD);

    const decoded = decodeJwt(token);
    expect(typeof decoded.iat).toBe("number");
    expect(typeof decoded.exp).toBe("number");
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(86400);

    await expect(verifySessionToken(`${token}tampered`)).resolves.toBeNull();
  });

  it("rejects an expired session JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ ...SESSION_PAYLOAD })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET ?? ""));

    await expect(verifySessionToken(expiredToken)).resolves.toBeNull();
  });

  it("builds an HTTP-only lax cookie with a one-day max age", () => {
    const options = buildSessionCookieOptions();

    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
      secure: false,
    });

    vi.stubEnv("NODE_ENV", "production");
    expect(buildSessionCookieOptions().secure).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("frozen AI provider configuration", () => {
  it("uses the exact models and endpoints for all three providers", () => {
    expect(AI_MODEL_CONFIG.openai.model).toBe("gpt-6-luna");
    expect(AI_MODEL_CONFIG.openai.endpoint).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(AI_MODEL_CONFIG.gemini.model).toBe("gemini-3.8-flash");
    expect(AI_MODEL_CONFIG.gemini.endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect(AI_MODEL_CONFIG.ollama.model).toBe("deepseek-v4.1-flash:1017");
    expect(AI_MODEL_CONFIG.ollama.endpoint).toBe("https://ollama.com/api/chat");
  });

  it("requires a user API key and never falls back to environment variables", () => {
    const originalOpenAiKey = process.env.openai_key;
    const originalGeminiKey = process.env.gemini_key;
    const originalOllamaKey = process.env.ollama_key;

    process.env.openai_key = "env-secret";
    process.env.gemini_key = "env-secret";
    process.env.ollama_key = "env-secret";

    try {
      expect(resolveAiApiKey("openai", "  user-key  ")).toBe("user-key");

      for (const provider of ["openai", "gemini", "ollama"] as const) {
        for (const apiKey of [undefined, "", "   "]) {
          const error = captureAiClientError(() =>
            resolveAiApiKey(provider, apiKey),
          );

          expect(error).toBeInstanceOf(AiClientError);
          expect(error.status).toBe(400);
          expect(error.message).toBe(
            `Missing API key for AI provider ${provider}. You must provide your own API key.`,
          );
          expect(error.message).not.toContain("env-secret");
        }
      }
    } finally {
      restoreEnvVar("openai_key", originalOpenAiKey);
      restoreEnvVar("gemini_key", originalGeminiKey);
      restoreEnvVar("ollama_key", originalOllamaKey);
    }
  });

  it("extracts a JSON object from fenced or prose-wrapped output", () => {
    expect(
      extractJsonObject('Here is the result:\n```json\n{"score": 88}\n```'),
    ).toEqual({ score: 88 });

    expect(() => extractJsonObject("No JSON here at all")).toThrowError(
      AiClientError,
    );
  });
});

describe("interview question validation", () => {
  it("accepts 10 bilingual questions and assigns sequence ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        buildOpenAiResponse({
          questions: Array.from({ length: 10 }, (_, index) =>
            buildQuestion(index),
          ),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateInterviewQuestions({
      jdText: "We are hiring a senior full-stack engineer.",
      provider: "openai",
      apiKey: "sk-user-key",
    });

    expect(result.model).toBe("gpt-6-luna");
    expect(result.interview.questions).toHaveLength(10);
    expect(result.interview.questions.map((question) => question.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(result.interview.questions[0]?.question.zh).toContain("問題");

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call?.[0]).toBe("https://api.openai.com/v1/chat/completions");
    const headers = call?.[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-user-key");
  });

  it("accepts the 15-question upper bound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildGeminiResponse({
          questions: Array.from({ length: 15 }, (_, index) =>
            buildQuestion(index),
          ),
        }),
      ),
    );

    const result = await generateInterviewQuestions({
      jdText: "Senior platform engineer role.",
      provider: "gemini",
      apiKey: "gemini-key",
    });

    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.interview.questions).toHaveLength(15);
  });

  it("rejects fewer than 10 questions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildOpenAiResponse({
          questions: Array.from({ length: 9 }, (_, index) =>
            buildQuestion(index),
          ),
        }),
      ),
    );

    await expect(
      generateInterviewQuestions({
        jdText: "Senior platform engineer role.",
        provider: "openai",
        apiKey: "sk-user-key",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("rejects more than 15 questions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildOpenAiResponse({
          questions: Array.from({ length: 16 }, (_, index) =>
            buildQuestion(index),
          ),
        }),
      ),
    );

    await expect(
      generateInterviewQuestions({
        jdText: "Senior platform engineer role.",
        provider: "openai",
        apiKey: "sk-user-key",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});

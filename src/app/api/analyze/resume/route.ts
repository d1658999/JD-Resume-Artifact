import { Types } from "mongoose";
import { z } from "zod";

import { AiClientError, reviewResumeAgainstJd } from "@/lib/ai-client";
import { getSessionFromCookies } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ScraperError, fetchJobDescriptionFromUrl } from "@/lib/scraper";
import {
  ArtifactRecordModel,
  toArtifactRecordDTO,
  type ArtifactRecordAttributes,
} from "@/models/ArtifactRecord";

import type { SessionPayload } from "@/types/domain";

const MAX_JD_TITLE_LENGTH = 160;
const DEFAULT_JD_TITLE = "Untitled Job Description";

const requestSchema = z
  .object({
    recordId: z.string().trim().nullish(),
    jdUrl: z.string().trim().max(2048, "jdUrl is too long.").optional(),
    jdFallbackText: z.string().trim().optional(),
    resumeText: z.string().trim().min(1, "Resume text is required."),
    resumeSourceType: z
      .enum(["pdf", "docx", "google_docs", "notion"])
      .nullish(),
    resumeFileName: z.string().trim().nullish(),
    resumeBlobUrl: z.string().trim().nullish(),
    resumeSourceUrl: z.string().trim().nullish(),
    provider: z.enum(["openai", "gemini", "ollama"]),
    apiKey: z.string().trim().nullish(),
  })
  .refine(
    (value) =>
      (value.jdUrl ?? "") !== "" ||
      (value.jdFallbackText ?? "") !== "" ||
      (value.recordId ?? "") !== "",
    {
      message: "Provide either jdUrl or jdFallbackText.",
      path: ["jdUrl"],
    },
  );

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSessionFromCookies();

  if (!session || !Types.ObjectId.isValid(session.userId)) {
    return null;
  }

  return session;
}

function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "Invalid request body.";
  }

  const path = issue.path.join(".");

  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

function firstMeaningfulLine(text: string): string | null {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();

    if (line !== "") {
      return line.length > MAX_JD_TITLE_LENGTH
        ? `${line.slice(0, MAX_JD_TITLE_LENGTH).trimEnd()}...`
        : line;
    }
  }

  return null;
}

function extractHostname(jdUrl: string): string | null {
  if (jdUrl === "") {
    return null;
  }

  try {
    const hostname = new URL(jdUrl).hostname.replace(/^www\./i, "");
    return hostname === "" ? null : hostname;
  } catch {
    return null;
  }
}

function clampTitle(title: string): string {
  const trimmed = title.trim();

  if (trimmed.length <= MAX_JD_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_JD_TITLE_LENGTH).trimEnd()}...`;
}

function deriveJdTitle(params: {
  existingTitle?: string | null;
  scrapedTitle?: string | null;
  jdUrl: string;
  jdText: string;
}): string {
  const existingTitle = params.existingTitle?.trim() ?? "";

  if (existingTitle !== "") {
    return clampTitle(existingTitle);
  }

  const scrapedTitle = params.scrapedTitle?.trim() ?? "";

  if (scrapedTitle !== "") {
    return clampTitle(scrapedTitle);
  }

  const firstLine = firstMeaningfulLine(params.jdText);

  if (firstLine !== null) {
    return firstLine;
  }

  const hostname = extractHostname(params.jdUrl);

  if (hostname !== null) {
    return hostname;
  }

  return DEFAULT_JD_TITLE;
}

async function resolveJd(params: {
  jdUrl: string;
  jdFallbackText?: string;
  existingTitle?: string | null;
}): Promise<{ jdText: string; jdUrl: string; jdTitle: string }> {
  const fallbackText = params.jdFallbackText?.trim() ?? "";

  if (fallbackText !== "") {
    return {
      jdText: fallbackText,
      jdUrl: params.jdUrl,
      jdTitle: deriveJdTitle({
        existingTitle: params.existingTitle,
        jdUrl: params.jdUrl,
        jdText: fallbackText,
      }),
    };
  }

  const scraped = await fetchJobDescriptionFromUrl(params.jdUrl);
  const jdText = scraped.text.trim();

  return {
    jdText,
    jdUrl: scraped.url,
    jdTitle: deriveJdTitle({
      existingTitle: params.existingTitle,
      scrapedTitle: scraped.title,
      jdUrl: scraped.url,
      jdText,
    }),
  };
}

function redactSecret(message: string, secret?: string | null): string {
  const value = secret?.trim() ?? "";

  if (value === "") {
    return message;
  }

  return message.split(value).join("[redacted]");
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();

  if (!session) {
    return jsonError(401, "Not authenticated.");
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return jsonError(400, "Invalid JSON body.");
  }

  const parsedBody = requestSchema.safeParse(body.value);

  if (!parsedBody.success) {
    return jsonError(400, formatValidationError(parsedBody.error));
  }

  const input = parsedBody.data;
  const recordId = input.recordId?.trim() ?? "";

  if (recordId !== "" && !Types.ObjectId.isValid(recordId)) {
    return jsonError(400, "Invalid record id.");
  }

  try {
    await connectToDatabase();

    const existingRecord =
      recordId === ""
        ? null
        : await ArtifactRecordModel.findOne({
            _id: new Types.ObjectId(recordId),
            userId: session.userId,
          });

    if (recordId !== "" && !existingRecord) {
      return jsonError(404, "Record not found.");
    }

    const jd = await resolveJd({
      jdUrl: input.jdUrl?.trim() || existingRecord?.jdUrl || "",
      jdFallbackText: input.jdFallbackText,
      existingTitle: existingRecord?.jdTitle,
    });

    const { review, model } = await reviewResumeAgainstJd({
      jdText: jd.jdText,
      resumeText: input.resumeText,
      provider: input.provider,
      apiKey: input.apiKey ?? undefined,
    });

    const update: Partial<ArtifactRecordAttributes> = {
      userEmail: session.email,
      jdUrl: jd.jdUrl,
      jdTitle: jd.jdTitle,
      jdRawText: jd.jdText,
      aiProvider: input.provider,
      aiModel: model,
      resumeReview: review,
      resumeSourceType: input.resumeSourceType ?? null,
      resumeFileName: input.resumeFileName ?? null,
      resumeBlobUrl: input.resumeBlobUrl ?? null,
      resumeSourceUrl: input.resumeSourceUrl ?? null,
      resumeExtractedText: input.resumeText,
    };

    const savedRecord = existingRecord
      ? await ArtifactRecordModel.findOneAndUpdate(
          { _id: existingRecord._id, userId: session.userId },
          { $set: update },
          { new: true },
        )
      : await ArtifactRecordModel.create({
          userId: new Types.ObjectId(session.userId),
          ...update,
          jdAnalysis: null,
          interviewQuestions: null,
        });

    if (!savedRecord) {
      return jsonError(404, "Record not found.");
    }

    return Response.json(
      { record: toArtifactRecordDTO(savedRecord) },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AiClientError) {
      return jsonError(
        error.status,
        redactSecret(error.message, input.apiKey),
      );
    }

    if (error instanceof ScraperError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(500, "Failed to review the resume.");
  }
}

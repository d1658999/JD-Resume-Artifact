import { Types } from "mongoose";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth";
import {
  ResumeParserError,
  parseAndStorePdfOrDocx,
  parseAndStorePublicLink,
} from "@/lib/resume-parser";

import type { SessionPayload } from "@/types/domain";

const publicLinkSchema = z.object({
  sourceType: z.enum(["google_docs", "notion"]),
  url: z.string().trim().min(1, "URL is required."),
});

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

async function handleFileUpload(request: Request): Promise<Response> {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Invalid multipart form data.");
  }

  const file = form.get("file");

  if (!(file instanceof File)) {
    return jsonError(400, 'Upload a file using the "file" form field.');
  }

  try {
    const parsed = await parseAndStorePdfOrDocx(file);
    return Response.json(parsed, { status: 200 });
  } catch (error) {
    if (error instanceof ResumeParserError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(500, "Failed to process the uploaded resume file.");
  }
}

async function handlePublicLink(request: Request): Promise<Response> {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return jsonError(400, "Invalid JSON body.");
  }

  const parsedBody = publicLinkSchema.safeParse(body.value);

  if (!parsedBody.success) {
    return jsonError(400, formatValidationError(parsedBody.error));
  }

  try {
    const parsed = await parseAndStorePublicLink(
      parsedBody.data.url,
      parsedBody.data.sourceType,
    );
    return Response.json(parsed, { status: 200 });
  } catch (error) {
    if (error instanceof ResumeParserError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(500, "Failed to import the resume from the public link.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();

  if (!session) {
    return jsonError(401, "Not authenticated.");
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    return handleFileUpload(request);
  }

  return handlePublicLink(request);
}

import { Types } from "mongoose";

import { getSessionFromCookies } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArtifactRecordModel, toArtifactRecordDTO } from "@/models/ArtifactRecord";

import type { SessionPayload } from "@/types/domain";

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

export async function GET(): Promise<Response> {
  const session = await requireSession();

  if (!session) {
    return jsonError(401, "Not authenticated.");
  }

  try {
    await connectToDatabase();

    const records = await ArtifactRecordModel.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json(
      { records: records.map((record) => toArtifactRecordDTO(record)) },
      { status: 200 },
    );
  } catch {
    return jsonError(500, "Failed to load records.");
  }
}

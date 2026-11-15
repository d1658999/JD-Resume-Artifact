import { Types } from "mongoose";

import { getSessionFromCookies } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArtifactRecordModel } from "@/models/ArtifactRecord";

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireSession();

  if (!session) {
    return jsonError(401, "Not authenticated.");
  }

  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return jsonError(400, "Invalid record id.");
  }

  try {
    await connectToDatabase();

    const result = await ArtifactRecordModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: session.userId,
    });

    if (result.deletedCount === 0) {
      return jsonError(404, "Record not found.");
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return jsonError(500, "Failed to delete the record.");
  }
}

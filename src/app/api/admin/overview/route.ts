import { Types } from "mongoose";
import { z } from "zod";

import { ADMIN_EMAIL, getSessionFromCookies, hashPassword } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArtifactRecordModel, toArtifactRecordDTO } from "@/models/ArtifactRecord";
import { UserModel, toPublicUser } from "@/models/User";

import type { SessionPayload } from "@/types/domain";

const updateRoleSchema = z.union(
  [
    z.object({
      userId: z.string().trim().min(1, "User id is required."),
      role: z.enum(["user", "admin"]),
    }),
    z.object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      role: z.enum(["user", "admin"]),
    }),
  ],
  "Provide either userId or email together with a valid role.",
);

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(6).max(128),
  gender: z.enum(["male", "female"]),
  role: z.enum(["user", "admin"]),
});

const deleteTargetSchema = z.object({
  targetType: z.enum(["user", "record"]),
  id: z.string().trim().min(1, "Id is required."),
});

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "Invalid request body.";
  }

  const path = issue.path.join(".");

  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
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

type AdminGuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

async function requireAdmin(): Promise<AdminGuardResult> {
  const session = await getSessionFromCookies();

  if (!session || !Types.ObjectId.isValid(session.userId)) {
    return { ok: false, response: jsonError(401, "Not authenticated.") };
  }

  await connectToDatabase();

  const currentUser = await UserModel.findById(session.userId)
    .select("role")
    .lean();

  if (!currentUser || currentUser.role !== "admin") {
    return { ok: false, response: jsonError(403, "Admin access required.") };
  }

  return { ok: true, session };
}

export async function GET(): Promise<Response> {
  try {
    const guard = await requireAdmin();

    if (!guard.ok) {
      return guard.response;
    }

    const [users, records] = await Promise.all([
      UserModel.find({}).select("-passwordHash").lean(),
      ArtifactRecordModel.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const totalResumesWithBlob = records.filter(
      (record) =>
        typeof record.resumeBlobUrl === "string" &&
        record.resumeBlobUrl.trim() !== "",
    ).length;

    return Response.json(
      {
        users: users.map((user) => toPublicUser(user)),
        records: records.map((record) => toArtifactRecordDTO(record)),
        stats: {
          totalUsers: users.length,
          totalRecords: records.length,
          totalResumesWithBlob,
        },
      },
      { status: 200 },
    );
  } catch {
    return jsonError(500, "Failed to load the admin overview.");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const guard = await requireAdmin();

    if (!guard.ok) {
      return guard.response;
    }

    const body = await readJsonBody(request);

    if (!body.ok) {
      return jsonError(400, "Invalid JSON body.");
    }

    const parsedBody = updateRoleSchema.safeParse(body.value);

    if (!parsedBody.success) {
      return jsonError(400, formatValidationError(parsedBody.error));
    }

    const payload = parsedBody.data;
    const { role } = payload;

    let targetId: string;
    let targetEmail: string;

    if ("userId" in payload) {
      if (!Types.ObjectId.isValid(payload.userId)) {
        return jsonError(400, "Invalid user id.");
      }

      const targetUser = await UserModel.findById(payload.userId)
        .select("email")
        .lean();

      if (!targetUser) {
        return jsonError(404, "User not found.");
      }

      targetId = payload.userId;
      targetEmail = targetUser.email;
    } else {
      const targetUser = await UserModel.findOne({ email: payload.email })
        .select("email")
        .lean();

      if (!targetUser) {
        return jsonError(404, "User not found.");
      }

      targetId = targetUser._id.toString();
      targetEmail = targetUser.email;
    }

    if (targetEmail.trim().toLowerCase() === ADMIN_EMAIL && role !== "admin") {
      return jsonError(
        400,
        "The primary admin account must keep the admin role.",
      );
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      targetId,
      { $set: { role } },
      { new: true },
    ).select("-passwordHash");

    if (!updatedUser) {
      return jsonError(404, "User not found.");
    }

    return Response.json(
      { user: toPublicUser(updatedUser) },
      { status: 200 },
    );
  } catch {
    return jsonError(500, "Failed to update the user role.");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const guard = await requireAdmin();

    if (!guard.ok) {
      return guard.response;
    }

    const body = await readJsonBody(request);

    if (!body.ok) {
      return jsonError(400, "Invalid JSON body.");
    }

    const parsedBody = createUserSchema.safeParse(body.value);

    if (!parsedBody.success) {
      return jsonError(400, formatValidationError(parsedBody.error));
    }

    const { email, name, password, gender, role } = parsedBody.data;

    const existingUser = await UserModel.findOne({ email }).lean();

    if (existingUser) {
      return jsonError(409, "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const resolvedRole = email === ADMIN_EMAIL ? "admin" : role;

    try {
      const user = await UserModel.create({
        email,
        passwordHash,
        name,
        gender,
        role: resolvedRole,
      });

      return Response.json({ user: toPublicUser(user) }, { status: 201 });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return jsonError(409, "An account with this email already exists.");
      }

      throw error;
    }
  } catch {
    return jsonError(500, "Failed to create the user.");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const guard = await requireAdmin();

    if (!guard.ok) {
      return guard.response;
    }

    const body = await readJsonBody(request);

    if (!body.ok) {
      return jsonError(400, "Invalid JSON body.");
    }

    const parsedBody = deleteTargetSchema.safeParse(body.value);

    if (!parsedBody.success) {
      return jsonError(400, formatValidationError(parsedBody.error));
    }

    const { targetType, id } = parsedBody.data;

    if (!Types.ObjectId.isValid(id)) {
      return jsonError(400, "Invalid id.");
    }

    if (targetType === "record") {
      const result = await ArtifactRecordModel.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return jsonError(404, "Record not found.");
      }

      return Response.json({ ok: true }, { status: 200 });
    }

    const targetUser = await UserModel.findById(id).select("email").lean();

    if (!targetUser) {
      return jsonError(404, "User not found.");
    }

    if (targetUser.email.trim().toLowerCase() === ADMIN_EMAIL) {
      return jsonError(
        400,
        "The primary admin account cannot be deleted.",
      );
    }

    await ArtifactRecordModel.deleteMany({ userId: id });
    await UserModel.deleteOne({ _id: id });

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return jsonError(500, "Failed to delete the requested item.");
  }
}

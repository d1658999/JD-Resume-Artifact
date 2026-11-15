import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH, POST } from "@/app/api/admin/overview/route";
import { ADMIN_EMAIL, verifyPassword } from "@/lib/auth";
import type { Gender, UserRole } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getSessionFromCookies: vi.fn(),
  connectToDatabase: vi.fn(),
  userFindOne: vi.fn(),
  userFindById: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  userExists: vi.fn(),
  userFindByIdAndUpdate: vi.fn(),
  userFindOneAndUpdate: vi.fn(),
  userDeleteOne: vi.fn(),
  userDeleteMany: vi.fn(),
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
      findByIdAndUpdate: mocks.userFindByIdAndUpdate,
      findOneAndUpdate: mocks.userFindOneAndUpdate,
      deleteOne: mocks.userDeleteOne,
      deleteMany: mocks.userDeleteMany,
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

const SESSION_ADMIN_ID = "64b7f0c2f1a2b3c4d5e6f701";
const PRIMARY_ADMIN_ID = "64b7f0c2f1a2b3c4d5e6f702";
const MEMBER_ID = "64b7f0c2f1a2b3c4d5e6f703";

interface FakeUserInput {
  email: string;
  passwordHash: string;
  name: string;
  gender: Gender;
  role: UserRole;
}

interface FakeUserDocument {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  gender: Gender;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<FakeUserDocument>;
}

interface SelectableQuery extends Promise<unknown> {
  lean: () => Promise<unknown>;
  select: (projection?: string) => SelectableQuery;
  sort: (spec?: Record<string, 1 | -1>) => SelectableQuery;
  limit: (count?: number) => SelectableQuery;
}

type Projector = (value: unknown, projection?: string) => unknown;

function makeQuery(value: unknown, project?: Projector): SelectableQuery {
  const query = Promise.resolve(value) as SelectableQuery;

  query.lean = () => Promise.resolve(value);
  query.select = (projection) =>
    project ? makeQuery(project(value, projection), project) : query;
  query.sort = () => query;
  query.limit = () => query;

  return query;
}

function projectUser(value: unknown, projection?: string): unknown {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof projection !== "string" ||
    !projection.includes("-passwordHash")
  ) {
    return value;
  }

  const projected = { ...(value as Record<string, unknown>) };
  delete projected.passwordHash;

  return projected;
}

function makeUserDocument(
  input: FakeUserInput,
  id?: Types.ObjectId,
): FakeUserDocument {
  const document: FakeUserDocument = {
    _id: id ?? new Types.ObjectId(),
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    gender: input.gender,
    role: input.role,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    save: () => Promise.resolve(document),
  };

  return document;
}

let users: FakeUserDocument[] = [];

function seedUser(input: FakeUserInput, id?: string): FakeUserDocument {
  const document = makeUserDocument(
    input,
    id ? new Types.ObjectId(id) : undefined,
  );
  users.push(document);

  return document;
}

function findUserByEmail(email: unknown): FakeUserDocument | null {
  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();

  return users.find((user) => user.email === normalized) ?? null;
}

function findUserById(id: unknown): FakeUserDocument | null {
  if (id === null || id === undefined) {
    return null;
  }

  const key = String(id);

  return users.find((user) => user._id.toString() === key) ?? null;
}

function signInAs(user: FakeUserDocument): void {
  mocks.getSessionFromCookies.mockResolvedValue({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    gender: user.gender,
    name: user.name,
  });
}

function signInAsAdmin(): FakeUserDocument {
  const admin = seedUser(
    {
      email: "session-admin@example.com",
      passwordHash: "stored-hash",
      name: "Session Admin",
      gender: "female",
      role: "admin",
    },
    SESSION_ADMIN_ID,
  );
  signInAs(admin);

  return admin;
}

interface RoleUpdate {
  $set?: { role?: UserRole };
  role?: UserRole;
}

function applyRoleUpdate(
  document: FakeUserDocument | null,
  update?: RoleUpdate,
): FakeUserDocument | null {
  if (!document) {
    return null;
  }

  const nextRole = update?.$set?.role ?? update?.role;

  if (nextRole === "user" || nextRole === "admin") {
    document.role = nextRole;
    document.updatedAt = new Date("2026-01-02T00:00:00.000Z");
  }

  return document;
}

function jsonRequest(method: "POST" | "PATCH", body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/overview", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  users = [];

  mocks.getSessionFromCookies.mockReset().mockResolvedValue(null);
  mocks.connectToDatabase.mockReset().mockResolvedValue(undefined);
  mocks.userFindOne.mockReset().mockImplementation(
    (filter?: { email?: unknown; _id?: unknown } | null) => {
      if (!filter) {
        return makeQuery(null, projectUser);
      }

      if ("email" in filter) {
        return makeQuery(findUserByEmail(filter.email), projectUser);
      }

      if ("_id" in filter) {
        return makeQuery(findUserById(filter._id), projectUser);
      }

      return makeQuery(null, projectUser);
    },
  );
  mocks.userFindById
    .mockReset()
    .mockImplementation((id?: unknown) =>
      makeQuery(findUserById(id), projectUser),
    );
  mocks.userFind.mockReset().mockReturnValue(makeQuery([]));
  mocks.userCreate.mockReset().mockImplementation((input: FakeUserInput) => {
    const document = makeUserDocument({
      ...input,
      email: input.email.trim().toLowerCase(),
    });
    users.push(document);

    return Promise.resolve(document);
  });
  mocks.userExists.mockReset().mockReturnValue(makeQuery(null));
  mocks.userFindByIdAndUpdate.mockReset().mockImplementation(
    (id?: unknown, update?: RoleUpdate) =>
      makeQuery(applyRoleUpdate(findUserById(id), update), projectUser),
  );
  mocks.userFindOneAndUpdate.mockReset().mockImplementation(
    (
      filter?: { email?: unknown; _id?: unknown } | null,
      update?: RoleUpdate,
    ) => {
      const target = filter
        ? "email" in filter
          ? findUserByEmail(filter.email)
          : "_id" in filter
            ? findUserById(filter._id)
            : null
        : null;

      return makeQuery(applyRoleUpdate(target, update), projectUser);
    },
  );
  mocks.userDeleteOne.mockReset();
  mocks.userDeleteMany.mockReset();
  mocks.artifactFind.mockReset().mockReturnValue(makeQuery([]));
  mocks.artifactFindOne.mockReset();
  mocks.artifactCreate.mockReset();
  mocks.artifactFindOneAndUpdate.mockReset();
  mocks.artifactDeleteOne.mockReset();
  mocks.artifactDeleteMany.mockReset();
});

describe("POST /api/admin/overview", () => {
  const validPayload = {
    email: "new.member@example.com",
    name: "New Member",
    password: "secret123",
    gender: "male" as Gender,
    role: "user" as UserRole,
  };

  it("returns 401 without a session and creates nothing", async () => {
    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(401);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin session and creates nothing", async () => {
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );
    signInAs(member);

    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(403);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payloads and creates nothing", async () => {
    signInAsAdmin();

    const invalidPayloads: Array<{ label: string; body: unknown }> = [
      { label: "unsupported gender", body: { ...validPayload, gender: "other" } },
      { label: "unsupported role", body: { ...validPayload, role: "superadmin" } },
      {
        label: "missing name",
        body: {
          email: validPayload.email,
          password: validPayload.password,
          gender: validPayload.gender,
          role: validPayload.role,
        },
      },
      {
        label: "missing email",
        body: {
          name: validPayload.name,
          password: validPayload.password,
          gender: validPayload.gender,
          role: validPayload.role,
        },
      },
    ];

    for (const { label, body } of invalidPayloads) {
      const response = await POST(jsonRequest("POST", body));
      expect(response.status, label).toBe(400);
    }

    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for a password shorter than 6 characters", async () => {
    signInAsAdmin();

    const response = await POST(
      jsonRequest("POST", { ...validPayload, password: "12345" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate email and creates nothing", async () => {
    signInAsAdmin();
    const existing = seedUser({
      email: validPayload.email,
      passwordHash: "stored-hash",
      name: "Existing Member",
      gender: "female",
      role: "user",
    });

    mocks.userFindOne.mockReturnValue(makeQuery(existing, projectUser));
    mocks.userExists.mockReturnValue(makeQuery({ _id: existing._id }));

    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(409);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the insert races into a duplicate key error", async () => {
    signInAsAdmin();
    mocks.userCreate.mockRejectedValue({ code: 11000 });

    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(409);
    expect(mocks.userCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the insert fails for a non-duplicate reason", async () => {
    signInAsAdmin();
    mocks.userCreate.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(500);
  });

  it("forces the primary admin role even when the payload asks for user", async () => {
    signInAsAdmin();

    const response = await POST(
      jsonRequest("POST", {
        ...validPayload,
        email: " Pricewu168@Gmail.com ",
        role: "user",
      }),
    );

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      user: { email: string; role: string };
    };

    expect(body.user.email).toBe(ADMIN_EMAIL);
    expect(body.user.role).toBe("admin");

    expect(mocks.userFindOne).toHaveBeenCalledWith({ email: ADMIN_EMAIL });

    const created = mocks.userCreate.mock.calls[0]?.[0] as FakeUserInput;

    expect(created.email).toBe(ADMIN_EMAIL);
    expect(created.role).toBe("admin");
  });

  it("creates the account with a bcrypt password hash and a public user payload", async () => {
    signInAsAdmin();

    const response = await POST(jsonRequest("POST", validPayload));

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      user: {
        id: string;
        email: string;
        name: string;
        gender: string;
        role: string;
      };
    };

    expect(typeof body.user.id).toBe("string");
    expect(body.user).toMatchObject({
      email: validPayload.email,
      name: validPayload.name,
      gender: "male",
      role: "user",
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    expect(mocks.userCreate).toHaveBeenCalledTimes(1);
    const created = mocks.userCreate.mock.calls[0]?.[0] as FakeUserInput;

    expect(created.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(created.passwordHash).not.toBe(validPayload.password);
    await expect(
      verifyPassword(validPayload.password, created.passwordHash),
    ).resolves.toBe(true);
  });
});

describe("PATCH /api/admin/overview", () => {
  it("returns 401 without a session and updates nothing", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { userId: MEMBER_ID, role: "admin" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.userFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin session and updates nothing", async () => {
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );
    signInAs(member);

    const response = await PATCH(
      jsonRequest("PATCH", { userId: MEMBER_ID, role: "admin" }),
    );

    expect(response.status).toBe(403);
    expect(member.role).toBe("user");
    expect(mocks.userFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payloads and updates nothing", async () => {
    signInAsAdmin();
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );

    const invalidPayloads: Array<{ label: string; body: unknown }> = [
      { label: "missing role", body: { email: "member@example.com" } },
      { label: "missing identifier", body: { role: "admin" } },
      {
        label: "unsupported role",
        body: { email: "member@example.com", role: "superadmin" },
      },
      {
        label: "malformed email",
        body: { email: "not-an-email", role: "admin" },
      },
      {
        label: "invalid user id",
        body: { userId: "not-an-object-id", role: "admin" },
      },
      { label: "blank user id", body: { userId: "   ", role: "admin" } },
    ];

    for (const { label, body } of invalidPayloads) {
      const response = await PATCH(jsonRequest("PATCH", body));
      expect(response.status, label).toBe(400);
    }

    expect(member.role).toBe("user");
    expect(mocks.userFindOne).not.toHaveBeenCalled();
    expect(mocks.userFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("normalizes email case and whitespace before the lookup", async () => {
    signInAsAdmin();
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );

    const response = await PATCH(
      jsonRequest("PATCH", { email: "  Member@Example.COM ", role: "admin" }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      user: { email: string; role: string };
    };

    expect(body.user.email).toBe("member@example.com");
    expect(body.user.role).toBe("admin");
    expect(member.role).toBe("admin");
    expect(mocks.userFindOne).toHaveBeenCalledWith({
      email: "member@example.com",
    });
  });

  it("returns 404 when the email matches no user", async () => {
    signInAsAdmin();

    const response = await PATCH(
      jsonRequest("PATCH", { email: "missing@example.com", role: "admin" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.userFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses to demote the primary admin by email", async () => {
    signInAsAdmin();
    const primaryAdmin = seedUser(
      {
        email: ADMIN_EMAIL,
        passwordHash: "stored-hash",
        name: "Primary Admin",
        gender: "female",
        role: "admin",
      },
      PRIMARY_ADMIN_ID,
    );

    const response = await PATCH(
      jsonRequest("PATCH", { email: ADMIN_EMAIL, role: "user" }),
    );

    expect(response.status).toBe(400);
    expect(primaryAdmin.role).toBe("admin");
    expect(mocks.userFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("grants the admin role by email", async () => {
    signInAsAdmin();
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );

    const response = await PATCH(
      jsonRequest("PATCH", { email: "member@example.com", role: "admin" }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      user: { email: string; role: string };
    };

    expect(body.user.email).toBe("member@example.com");
    expect(body.user.role).toBe("admin");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(member.role).toBe("admin");
  });

  it("still updates the role by user id", async () => {
    signInAsAdmin();
    const member = seedUser(
      {
        email: "member@example.com",
        passwordHash: "stored-hash",
        name: "Member",
        gender: "male",
        role: "user",
      },
      MEMBER_ID,
    );

    const response = await PATCH(
      jsonRequest("PATCH", { userId: MEMBER_ID, role: "admin" }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      user: { email: string; role: string };
    };

    expect(body.user.email).toBe("member@example.com");
    expect(body.user.role).toBe("admin");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(member.role).toBe("admin");
  });
});

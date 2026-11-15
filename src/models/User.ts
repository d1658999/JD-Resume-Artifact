import { Schema, model, models } from "mongoose";
import type { HydratedDocument, Model } from "mongoose";

import { getMentorProfile } from "@/lib/auth";
import type { Gender, PublicUser, UserRole } from "@/types/domain";

const USER_GENDERS: readonly Gender[] = ["male", "female"];
const USER_ROLES: readonly UserRole[] = ["user", "admin"];

export interface UserAttributes {
  email: string;
  passwordHash: string;
  name: string;
  gender: Gender;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, required: true, enum: USER_GENDERS },
    role: { type: String, required: true, enum: USER_ROLES, default: "user" },
  },
  { timestamps: true },
);

export const UserModel: Model<UserAttributes> =
  (models.User as Model<UserAttributes> | undefined) ??
  model<UserAttributes>("User", userSchema);

export function toPublicUser(user: {
  _id: { toString(): string };
  email: string;
  name: string;
  gender: Gender;
  role: UserRole;
  createdAt: Date;
}): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    gender: user.gender,
    role: user.role,
    mentor: getMentorProfile(user.gender),
    createdAt: user.createdAt.toISOString(),
  };
}
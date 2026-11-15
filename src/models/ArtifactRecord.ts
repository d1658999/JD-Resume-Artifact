import { Schema, model, models } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";

import type {
  AiProvider,
  ArtifactRecordDTO,
  BilingualList,
  BilingualText,
  InterviewPrepResult,
  InterviewQuestion,
  JdSkillAnalysis,
  ResumeModificationItem,
  ResumeReviewResult,
  ResumeScoreItem,
  ResumeSourceType,
} from "@/types/domain";

const AI_PROVIDERS: readonly AiProvider[] = ["openai", "gemini", "ollama"];
const RESUME_SOURCE_TYPES: readonly ResumeSourceType[] = [
  "pdf",
  "docx",
  "google_docs",
  "notion",
];
const INTERVIEW_QUESTION_TYPES: readonly InterviewQuestion["type"][] = [
  "technical",
  "behavioral",
  "system_design",
  "written_test",
];
const INTERVIEW_DIFFICULTIES: readonly InterviewQuestion["difficulty"][] = [
  "easy",
  "medium",
  "hard",
];

export interface ArtifactRecordAttributes {
  userId: Types.ObjectId;
  userEmail: string;
  jdUrl: string;
  jdTitle: string;
  jdRawText: string;
  aiProvider: AiProvider;
  aiModel: string;
  resumeSourceType: ResumeSourceType | null;
  resumeFileName: string | null;
  resumeBlobUrl: string | null;
  resumeSourceUrl: string | null;
  resumeExtractedText: string | null;
  jdAnalysis: JdSkillAnalysis | null;
  resumeReview: ResumeReviewResult | null;
  interviewQuestions: InterviewPrepResult | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ArtifactRecordDocument = HydratedDocument<ArtifactRecordAttributes>;

const bilingualTextSchema = new Schema<BilingualText>(
  {
    zh: { type: String },
    en: { type: String },
  },
  { _id: false },
);

const bilingualListSchema = new Schema<BilingualList>(
  {
    zh: { type: [String] },
    en: { type: [String] },
  },
  { _id: false },
);

const jdSkillAnalysisSchema = new Schema<JdSkillAnalysis>(
  {
    roleTitle: { type: bilingualTextSchema },
    companySummary: { type: bilingualTextSchema },
    seniorityLevel: { type: bilingualTextSchema },
    coreTechnicalSkills: { type: bilingualListSchema },
    toolsAndFrameworks: { type: bilingualListSchema },
    softSkills: { type: bilingualListSchema },
    niceToHaveSkills: { type: bilingualListSchema },
    keyResponsibilities: { type: bilingualListSchema },
  },
  { _id: false },
);

const resumeScoreItemSchema = new Schema<ResumeScoreItem>(
  {
    category: { type: bilingualTextSchema },
    score: { type: Number },
    maxScore: { type: Number },
    feedback: { type: bilingualTextSchema },
  },
  { _id: false },
);

const resumeModificationItemSchema = new Schema<ResumeModificationItem>(
  {
    section: { type: bilingualTextSchema },
    issue: { type: bilingualTextSchema },
    suggestion: { type: bilingualTextSchema },
    beforeSnippet: { type: String },
    afterSnippet: { type: bilingualTextSchema },
  },
  { _id: false },
);

const resumeReviewResultSchema = new Schema<ResumeReviewResult>(
  {
    overallScore: { type: Number },
    summary: { type: bilingualTextSchema },
    scoreBreakdown: { type: [resumeScoreItemSchema] },
    missingKeywords: { type: bilingualListSchema },
    modifications: { type: [resumeModificationItemSchema] },
  },
  { _id: false },
);

const interviewQuestionSchema = new Schema<InterviewQuestion>(
  {
    id: { type: Number },
    type: { type: String, enum: INTERVIEW_QUESTION_TYPES },
    difficulty: { type: String, enum: INTERVIEW_DIFFICULTIES },
    question: { type: bilingualTextSchema },
    testingFocus: { type: bilingualTextSchema },
    referenceAnswerPoints: { type: bilingualListSchema },
  },
  { _id: false },
);

const interviewPrepResultSchema = new Schema<InterviewPrepResult>(
  {
    questions: { type: [interviewQuestionSchema] },
  },
  { _id: false },
);

const artifactRecordSchema = new Schema<ArtifactRecordAttributes>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    jdUrl: { type: String, default: "" },
    jdTitle: { type: String, default: "" },
    jdRawText: { type: String, default: "" },
    aiProvider: { type: String, enum: AI_PROVIDERS, required: true },
    aiModel: { type: String, required: true },
    resumeSourceType: {
      type: String,
      enum: RESUME_SOURCE_TYPES,
      default: null,
    },
    resumeFileName: { type: String, default: null },
    resumeBlobUrl: { type: String, default: null },
    resumeSourceUrl: { type: String, default: null },
    resumeExtractedText: { type: String, default: null },
    jdAnalysis: { type: jdSkillAnalysisSchema, default: null },
    resumeReview: { type: resumeReviewResultSchema, default: null },
    interviewQuestions: { type: interviewPrepResultSchema, default: null },
  },
  { timestamps: true },
);

artifactRecordSchema.index({ userId: 1, createdAt: -1 });

export const ArtifactRecordModel: Model<ArtifactRecordAttributes> =
  (models.ArtifactRecord as Model<ArtifactRecordAttributes> | undefined) ??
  model<ArtifactRecordAttributes>("ArtifactRecord", artifactRecordSchema);

export function toArtifactRecordDTO(record: {
  _id: { toString(): string };
  userId: { toString(): string } | string;
  userEmail: string;
  jdUrl: string;
  jdTitle: string;
  aiProvider: AiProvider;
  aiModel: string;
  resumeSourceType: ResumeSourceType | null;
  resumeFileName: string | null;
  resumeBlobUrl: string | null;
  resumeSourceUrl: string | null;
  jdAnalysis: JdSkillAnalysis | null;
  resumeReview: ResumeReviewResult | null;
  interviewQuestions: InterviewPrepResult | null;
  createdAt: Date;
  updatedAt: Date;
}): ArtifactRecordDTO {
  return {
    id: record._id.toString(),
    userId: record.userId.toString(),
    userEmail: record.userEmail,
    jdUrl: record.jdUrl,
    jdTitle: record.jdTitle,
    aiProvider: record.aiProvider,
    aiModel: record.aiModel,
    resumeSourceType: record.resumeSourceType,
    resumeFileName: record.resumeFileName,
    resumeBlobUrl: record.resumeBlobUrl,
    resumeSourceUrl: record.resumeSourceUrl,
    jdAnalysis: record.jdAnalysis,
    resumeReview: record.resumeReview,
    interviewQuestions: record.interviewQuestions,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
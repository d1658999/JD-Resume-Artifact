export type UserRole = "user" | "admin";
export type Gender = "male" | "female";
export type AiProvider = "openai" | "gemini" | "ollama";
export type ResumeSourceType = "pdf" | "docx" | "google_docs" | "notion";

export interface MentorProfile {
  mentorGender: Gender;
  mentorName: string;
  mentorTitle: string;
  avatarUrl: string;
  greetingZh: string;
  greetingEn: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  gender: Gender;
  role: UserRole;
  mentor: MentorProfile;
  createdAt: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  gender: Gender;
  name: string;
}

export interface BilingualText {
  zh: string;
  en: string;
}

export interface BilingualList {
  zh: string[];
  en: string[];
}

export interface JdSkillAnalysis {
  roleTitle: BilingualText;
  companySummary: BilingualText;
  seniorityLevel: BilingualText;
  coreTechnicalSkills: BilingualList;
  toolsAndFrameworks: BilingualList;
  softSkills: BilingualList;
  niceToHaveSkills: BilingualList;
  keyResponsibilities: BilingualList;
}

export interface ResumeScoreItem {
  category: BilingualText;
  score: number;
  maxScore: number;
  feedback: BilingualText;
}

export interface ResumeModificationItem {
  section: BilingualText;
  issue: BilingualText;
  suggestion: BilingualText;
  beforeSnippet: string;
  afterSnippet: BilingualText;
}

export interface ResumeReviewResult {
  overallScore: number;
  summary: BilingualText;
  scoreBreakdown: ResumeScoreItem[];
  missingKeywords: BilingualList;
  modifications: ResumeModificationItem[];
}

export interface InterviewQuestion {
  id: number;
  type: "technical" | "behavioral" | "system_design" | "written_test";
  difficulty: "easy" | "medium" | "hard";
  question: BilingualText;
  testingFocus: BilingualText;
  referenceAnswerPoints: BilingualList;
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
}

export interface ArtifactRecordDTO {
  id: string;
  userId: string;
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
  createdAt: string;
  updatedAt: string;
}

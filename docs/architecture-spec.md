# JD-Resume-Artifact Architecture & Frozen Contracts

## 1. Environment & Stack
- **Framework**: Next.js 16.4.6 App Router (`cacheComponents: true` in `next.config.ts`)
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";` in `src/app/globals.css`)
- **Database**: MongoDB via `mongoose` (`process.env.MONGODB_URI`)
- **Storage**: Vercel Blob via `@vercel/blob` (`process.env.BLOB_READ_WRITE_TOKEN`, `process.env.BLOB_STORE_ID`)
- **Auth**: `bcryptjs` + `jose` HS256 JWT in HTTP-only Cookie (`maxAge: 86400` = 1 day)
- **Parsers**: `cheerio` (JD URL + Notion), `unpdf` (PDF), `mammoth` (DOCX)
- **Validation**: `zod`

### Critical Next.js 16 Rule (`cacheComponents: true`)
- Server Components MUST NOT call `cookies()` or `headers()` outside a `<Suspense>` boundary.
- Keep `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/workspace/page.tsx`, and `src/app/admin/page.tsx` free of top-level `cookies()` calls; read auth session via client-side fetch to `/api/auth/me` (or inside a `<Suspense>` child component).
- Route Handlers under `src/app/api/**` may freely read `cookies()` and `request.headers`.

---

## 2. Frozen Business Rules
1. **Registration Captcha**: User MUST submit `captcha === "job888"` (exact match). Reject others with HTTP 400.
2. **Admin Role**: ONLY `email.trim().toLowerCase() === "pricewu168@gmail.com"` gets `role: "admin"`. All other registrations get `role: "user"`.
3. **1-Day Cookie Session**:
   - Cookie name: `jd_artifact_session`
   - Options: `{ httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400, secure: process.env.NODE_ENV === "production" }`
   - JWT expiration: `24h`
4. **Gender-Swapped Japanese 2D Anime Mentor**:
   - Registered `gender === "male"` -> female mentor `/avatars/mentor-female.jpg`, `mentorGender: "female"`, `mentorName: "星野 凜 (Rin Hoshino)"`
   - Registered `gender === "female"` -> male mentor `/avatars/mentor-male.jpg`, `mentorGender: "male"`, `mentorName: "神谷 蒼 (Ao Kamiya)"`
5. **API Keys (`localStorage` + Privacy Notice)**:
   - Supported providers & fixed models:
     - `openai` -> `gpt-6-luna` (`https://api.openai.com/v1/chat/completions`)
     - `gemini` -> `gemini-3.8-flash` (`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, header `x-goog-api-key`)
     - `ollama` -> `deepseek-v4.1-flash:1017` (`https://ollama.com/api/chat`, `Authorization: Bearer <key>`, `stream: false`)
   - Frontend stores user keys in `localStorage` under key `jd_resume_artifact_api_keys` so page reload retains them unless cookies/site data are cleared.
   - UI MUST display a clear notice beside the API key field:
     `「我們不會保存您的 API Key —— 金鑰僅儲存於您的瀏覽器本機 localStorage，不會上傳至資料庫。」`
   - Every analyze request MUST include a non-empty, user-supplied `apiKey`. If it is missing or blank, the backend MUST throw `AiClientError(400, ...)`.
   - The backend MUST NEVER read `process.env.openai_key`, `process.env.gemini_key`, or `process.env.ollama_key` for AI calls; server environments never supply AI credentials.
   - Backend `ai-client.ts` MUST NEVER persist `apiKey` to MongoDB or log it.
6. **Resume Sources & Vercel Blob**:
   - Supports: `pdf`, `docx`, `google_docs` (public link), `notion` (public link).
   - Every uploaded file (or exported text snapshot for Google Docs / Notion) is uploaded to Vercel Blob via `@vercel/blob` `put()`, producing a `blobUrl`, and saved alongside AI outputs in MongoDB `ArtifactRecord`.
7. **Bilingual Output & Interview Questions**:
   - JD Skill Analysis: MUST include both `zh` (Traditional Chinese) and `en` (English).
   - Resume Review & Scoring: MUST include overall score (0-100), detailed category `scoreBreakdown`, `missingKeywords`, and concrete `modifications`, all bilingual (`zh` and `en`).
   - Mock Interview / Written Test: MUST generate **10 to 15** questions with `type`, `difficulty`, bilingual `question`, bilingual `testingFocus`, and bilingual `referenceAnswerPoints`.

---

## 3. Frozen File Map & Contracts

### `src/types/domain.ts`
```ts
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
```

### `src/lib/auth.ts` Exports
- `ADMIN_EMAIL = "pricewu168@gmail.com"`
- `REGISTRATION_CAPTCHA = "job888"`
- `COOKIE_NAME = "jd_artifact_session"`
- `COOKIE_MAX_AGE_SECONDS = 86400`
- `determineUserRole(email: string): UserRole`
- `getMentorProfile(gender: Gender): MentorProfile`
- `hashPassword(password: string): Promise<string>`
- `verifyPassword(password: string, passwordHash: string): Promise<boolean>`
- `signSessionToken(payload: SessionPayload): Promise<string>`
- `verifySessionToken(token: string): Promise<SessionPayload | null>`
- `getSessionFromCookies(): Promise<SessionPayload | null>`
- `buildSessionCookieOptions()`

### `src/lib/ai-client.ts` Exports
- `AI_MODEL_CONFIG`: `{ openai: { model: "gpt-6-luna", ... }, gemini: { model: "gemini-3.8-flash", ... }, ollama: { model: "deepseek-v4.1-flash:1017", ... } }`
- `AiClientError` (extends `Error`, has `readonly status: number`)
- `resolveAiApiKey(provider: AiProvider, userApiKey?: string): string` — trims the caller-supplied key, returns it when non-empty, and otherwise throws `AiClientError(400, ...)`; it never reads environment variables. The `analyzeJobDescription` / `reviewResumeAgainstJd` / `generateInterviewQuestions` params keep `apiKey?` optional in TypeScript, but every call funnels through this resolver, so a missing or blank key fails with HTTP 400.
- `extractJsonObject(raw: string): unknown`
- `analyzeJobDescription(params: { jdText: string; jdUrl: string; provider: AiProvider; apiKey?: string }): Promise<{ analysis: JdSkillAnalysis; model: string }>`
- `reviewResumeAgainstJd(params: { jdText: string; resumeText: string; provider: AiProvider; apiKey?: string }): Promise<{ review: ResumeReviewResult; model: string }>`
- `generateInterviewQuestions(params: { jdText: string; resumeText?: string; provider: AiProvider; apiKey?: string }): Promise<{ interview: InterviewPrepResult; model: string }>`

### `src/lib/db.ts`, `src/models/User.ts`, `src/models/ArtifactRecord.ts`
- `connectToDatabase(): Promise<typeof mongoose>` in `src/lib/db.ts`
- `UserModel` in `src/models/User.ts` (fields: `email`, `passwordHash`, `name`, `gender`, `role`, timestamps)
- `ArtifactRecordModel` in `src/models/ArtifactRecord.ts` (fields matching `ArtifactRecordDTO` + `jdRawText`, `resumeExtractedText`, timestamps)

### `src/lib/scraper.ts` & `src/lib/resume-parser.ts`
- `ScraperError` (`status: number`)
- `fetchJobDescriptionFromUrl(url: string): Promise<{ title: string; text: string; url: string }>`
- `ResumeParserError` (`status: number`)
- `parseAndStorePdfOrDocx(file: File): Promise<{ extractedText: string; blobUrl: string; fileName: string; sourceType: "pdf" | "docx"; sourceUrl: null }>`
- `parseAndStorePublicLink(url: string, sourceType: "google_docs" | "notion"): Promise<{ extractedText: string; blobUrl: string; fileName: string; sourceType: "google_docs" | "notion"; sourceUrl: string }>`

### API Endpoints
- `POST /api/auth/register` -> `{ email, password, name, gender, captcha }` -> sets cookie, returns `{ user }` (201)
- `POST /api/auth/login` -> `{ email, password }` -> sets cookie, returns `{ user }` (200)
- `POST /api/auth/logout` -> clears cookie, returns `{ ok: true }` (200)
- `GET /api/auth/me` -> returns `{ user }` (200) or 401
- `POST /api/resume/upload` -> multipart (`file`) or JSON (`{ sourceType, url }`) -> returns `{ extractedText, blobUrl, fileName, sourceType, sourceUrl }` (200)
- `POST /api/analyze/jd` -> `{ jdUrl, jdFallbackText?, provider, apiKey, recordId? }` -> returns `{ record }` (200). `apiKey` is required and must be non-blank; missing/blank returns 400.
- `POST /api/analyze/resume` -> `{ recordId?, jdUrl, jdFallbackText?, resumeText, resumeSourceType?, resumeFileName?, resumeBlobUrl?, resumeSourceUrl?, provider, apiKey }` -> returns `{ record }` (200). `apiKey` is required and must be non-blank; missing/blank returns 400.
- `POST /api/analyze/interview` -> `{ recordId?, jdUrl, jdFallbackText?, resumeText?, provider, apiKey }` -> returns `{ record }` (200). `apiKey` is required and must be non-blank; missing/blank returns 400.
- `GET /api/records` -> `{ records: ArtifactRecordDTO[] }` (200)
- `DELETE /api/records/[id]` -> `{ ok: true }` (200)
- `GET /api/admin/overview` -> `{ users: PublicUser[], records: ArtifactRecordDTO[], stats: { totalUsers, totalRecords, totalResumesWithBlob } }` (200, 403 if not admin)
- `PATCH /api/admin/overview` -> `{ userId, role }` -> updates user role (200, 403 if not admin)
- `DELETE /api/admin/overview` -> `{ targetType: "user" | "record", id: string }` -> deletes record or user (200, 403 if not admin)

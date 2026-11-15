# JD Resume Artifact｜雙語求職履歷工作台

A bilingual (Traditional Chinese / English) AI career studio built with **Next.js 16 App Router**, **React 19**, **Tailwind CSS v4**, **MongoDB / Mongoose**, and **Vercel Blob**.

Users paste a job description URL, upload a resume, and receive a bilingual JD skill map, a 0–100 resume review with before/after rewrites, and 10–15 mock interview / written-test questions. Every artifact is stored with its Vercel Blob resume link.

## Features

- **JD skill analysis** — scrapes a public job URL (with a manual-paste fallback) and returns bilingual core skills, tools/frameworks, soft skills, nice-to-have skills, and responsibilities.
- **Resume review & rewrite** — upload PDF/DOCX or import a public Google Docs / Notion link. The file or text snapshot is stored in Vercel Blob, then scored with category breakdowns, missing keywords, and concrete before/after suggestions.
- **Mock interview / written test** — generates 10–15 bilingual questions with type, difficulty, testing focus, and reference answer points.
- **Gender-swapped Japanese 2D anime mentor** — male registrants are matched with 星野 凜 (`/avatars/mentor-female.jpg`); female registrants are matched with 神谷 蒼 (`/avatars/mentor-male.jpg`).
- **1-day sessions** — bcrypt password hashing plus an HS256 JWT in an HTTP-only cookie (`jd_artifact_session`, `maxAge: 86400`).
- **Local-only, bring-your-own API keys** — you MUST enter your own OpenAI / Gemini / Ollama Cloud API key in the browser settings panel. Keys are stored in `localStorage` under `jd_resume_artifact_api_keys` and are never uploaded to MongoDB or written to logs. Every analyze request must carry the key you entered; the server never falls back to environment variables for AI calls.
- **Admin console** — only `pricewu168@gmail.com` receives the `admin` role. The console manages users, roles, artifact records, and Vercel Blob links.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Required environment variables (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string used by Mongoose. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token used for resume uploads. |
| `BLOB_STORE_ID` | Vercel Blob store identifier. |
| `JWT_SECRET` | Optional dedicated signing secret; falls back to a hash of `MONGODB_URI`. |

> **Bring your own key:** AI providers are never configured through the server environment. Users MUST enter their own OpenAI, Gemini, or Ollama Cloud API key in the browser settings panel; the key stays in `localStorage` (`jd_resume_artifact_api_keys`) and is sent with each analyze request. The server never falls back to environment variables for AI calls, and requests without a key are rejected with HTTP 400.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build (TypeScript + Next.js). |
| `npm start` | Run the production build. |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript). |
| `npm test` | Vitest suite. |
| `npm run test:watch` | Vitest watch mode. |

## API surface

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Requires `captcha: "job888"`; returns 201 and sets the session cookie. |
| `POST` | `/api/auth/login` | bcrypt verification, JWT cookie, 200. |
| `POST` | `/api/auth/logout` | Clears the session cookie, `{ ok: true }`. |
| `GET` | `/api/auth/me` | Returns `{ user }` or 401. |
| `POST` | `/api/resume/upload` | Multipart `file` (PDF/DOCX) or JSON `{ sourceType, url }` (Google Docs/Notion). |
| `POST` | `/api/analyze/jd` | Requires user-supplied `apiKey` (missing/blank → 400). Returns `{ record }` with bilingual JD analysis. |
| `POST` | `/api/analyze/resume` | Requires user-supplied `apiKey` (missing/blank → 400). Returns `{ record }` with scoring and modifications. |
| `POST` | `/api/analyze/interview` | Requires user-supplied `apiKey` (missing/blank → 400). Returns `{ record }` with 10–15 questions. |
| `GET` | `/api/records` | Lists the signed-in user's artifacts. |
| `DELETE` | `/api/records/[id]` | Deletes one owned artifact. |
| `GET` / `PATCH` / `DELETE` | `/api/admin/overview` | Admin-only overview, role changes, and deletions (403 for non-admins). |

## AI providers

| Provider | Fixed model | Endpoint |
| --- | --- | --- |
| OpenAI | `gpt-6-luna` | `https://api.openai.com/v1/chat/completions` |
| Gemini | `gemini-3.8-flash` | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent` |
| Ollama Cloud | `deepseek-v4.1-flash:1017` | `https://ollama.com/api/chat` |

## Verification

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The Vitest suite covers the captcha, admin-only email, bcrypt + 1-day JWT cookie, mentor gender swap, fixed AI model configuration, 10–15 question validation, admin 403 guard, logout, job-page scraping with the SSRF guard, Google Docs text import, and Vercel Blob snapshot upload. The PDF/DOCX → Vercel Blob flow was additionally verified end-to-end against the local MongoDB and Blob environment.

See [`docs/architecture-spec.md`](docs/architecture-spec.md) for the frozen contracts and [`requirements.md`](requirements.md) for the original product requirements.

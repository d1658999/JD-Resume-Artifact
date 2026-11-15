# Change 002 — Auth-aware Navigation & Admin Access Management

## Problem
1. After login, the Navbar (mounted once in the root layout) keeps its first `/api/auth/me` result, so it still shows「登入 / 免費註冊」and hides the「管理後台」link. Landing-page「免費註冊」CTAs are also always visible.
2. Admins have no visible back-office entry, and there is no way to **create accounts** or **grant admin by email**.

## Frozen Shared Contract (pre-authored by Lead Architect — DO NOT MODIFY)
`src/lib/auth-client.ts` exports:
- `AUTH_CHANGED_EVENT = "jd-auth-changed"`
- `notifyAuthChanged(): void` — call after login / register / logout succeeds, BEFORE navigation.
- `fetchCurrentUser(signal?): Promise<PublicUser | null>`
- `useCurrentUser(): { status: "loading" | "ready"; user: PublicUser | null; refresh(): Promise<void>; clear(): void }`
  (re-fetches on mount, pathname change, AUTH_CHANGED_EVENT, tab visibility).

## Acceptance Criteria
- AC-1: Logged-in user sees avatar/name + **登出** button in the top-right; **登入 / 免費註冊 are not rendered** (desktop + mobile menu).
- AC-2: Immediately after login/register (no manual reload) the Navbar switches to the logged-in state.
- AC-3: After logout the Navbar shows 登入 / 免費註冊 again.
- AC-4: Landing page「免費註冊」CTAs are replaced by「進入工作台」when logged in; footer hides 登入/註冊 when logged in and shows 管理後台 for admins.
- AC-5: Admin (role from DB) sees「管理後台」in Navbar (desktop + mobile).
- AC-6: `/admin` has an「帳號與權限管理」panel:
  - Grant/revoke admin by email (existing account) → `PATCH /api/admin/overview` `{ email, role }`.
  - Create a new account (name, email, password ≥ 6, gender, role) → `POST /api/admin/overview`.
  - List of current admins visible; primary admin `pricewu168@gmail.com` cannot be demoted/deleted.
- AC-7: Non-admin → 403 on POST/PATCH; duplicate email on create → 409; unknown email on grant → 404; invalid payload → 400.

## API Contract Additions (`src/app/api/admin/overview/route.ts`)
- `PATCH` body now accepts EITHER `{ userId, role }` OR `{ email, role }` (zod union). Same primary-admin protection.
- `POST` body: `{ email, name, password (6..128), gender: "male"|"female", role: "user"|"admin" }` → 201 `{ user: PublicUser }`; bcrypt via `hashPassword` from `@/lib/auth`; 409 on duplicate; 403 non-admin; 401 unauthenticated.

## Work Packets (disjoint write sets)
| ID | Engine | Write set |
|---|---|---|
| WP-1 Navbar | ollama-copilot | `src/components/Navbar.tsx` |
| WP-2 Auth pages | ollama-copilot | `src/app/login/page.tsx`, `src/app/register/page.tsx` |
| WP-3 Landing/Footer CTAs | ollama-copilot | `src/components/AuthAwareCta.tsx` (new), `src/components/FooterAuthLinks.tsx` (new), `src/app/page.tsx`, `src/app/layout.tsx` |
| WP-4 Admin API | ollama-copilot | `src/app/api/admin/overview/route.ts` |
| WP-5 Admin UI | ollama-copilot_2 | `src/components/AdminAccessPanel.tsx` (new), `src/components/AdminDashboard.tsx` |
| WP-6 Tests | ollama-copilot_2 | `tests/admin-access.test.ts` (new), `tests/auth-client.test.ts` (new) |

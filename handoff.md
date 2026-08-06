# Handoff — 反旗 / FlagBreaker

> Last session: 2026-07-31 | Branch: `feature/20260729`

## What Was Done This Session (2026-07-31)

### Round 8 — Documentation Sync (1 commit)

42. **README.md** — Updated directory structure to reflect all files added in Rounds 1–7 (e2e/, Sentry configs, push API, goals CRUD, OG image, IAP, dark mode components, validation/rateLimit/theme/push libs). Updated MVP scope section with all implemented features.
43. **AGENTS.md** — Updated architecture overview (added goals CRUD, push, OG, IAP, Sentry). Added security section items (CSP, Zod, Rate Limiting, Sentry). Added testing section. Updated file index with 15+ new entries. Added test commands.
44. **flag_breaker_ui_copy_layout.md** — Checked all 10 items in the verification checklist (all confirmed implemented in code).
45. **handoff.md** — Updated with this session's changes.

---

## Previous Session (2026-07-30)

### Round 1 — Project Hardening (10 commits)

1. **Schema fix** — Synced `flag_breaker_schema.sql` with migrations: added `persona` to `users`, `goal_id`/`checkins_count` to `weekly_reports`, `created_at` to `v_today_checkins`
2. **Config** — Added `CRON_SECRET` to `.env.local.example`
3. **Docs** — Wrote `AGENTS.md` with full project guidance for AI coding agents
4. **Docs** — Updated `README.md` to reflect current features (PWA, cron, dual persona, checkin notes)
5. **Timeout** — Added `AbortController` 15s timeout to doubao API calls
6. **Fix** — Corrected Few-Shot sample inconsistency (3 days → 2 days) in `persona.ts`
7. **Error handling** — Replaced `!` non-null assertions with explicit env checks in Supabase clients
8. **Styles** — Completed Tailwind color scales for `ink`, `success`, and `warn`
9. **Error boundary** — Added `ErrorBoundary.tsx` component for render fallback
10. **Security headers** — Added HTTP security headers in `next.config.js`

### Round 2 — Input Validation + Rate Limiting (2 commits)

11. **zod validation** — Created `src/lib/validations.ts` with schemas for all 4 API routes, added `parseBody`/`parseQuery` helpers
12. **Rate limiting** — Created `src/lib/rateLimit.ts` with sliding window algorithm, applied to `/api/checkin` (10/60s) and `/api/ai-feedback` real-time fallback (5/60s)

### Round 3 — Testing + CI (2 commits)

13. **Unit tests** — 41 tests across 3 suites: `validations.test.ts` (19), `rateLimit.test.ts` (9), `persona.test.ts` (13)
14. **Pre-commit hooks** — husky + lint-staged: eslint → prettier → type-check → vitest on every commit

### Round 4 — UI Polish & Bug Fixes (4 commits)

15. **Dynamic persona** — `AIFeedbackCard` now reads persona from `PERSONA_MAP`; dashboard & report page load user persona from DB and display correct emoji/label
16. **Editable age** — Settings page age field is now an editable input with validation (1-120 integer); removed redundant `getUser()` calls in `toggleRoast`/`savePersona`/`saveNickname`
17. **Error boundary** — Wrapped app children with `ErrorBoundary` in `layout.tsx`; added terms/privacy links on login page
18. **Week navigation** — Report page now supports historical week switching via prev/next arrows, with checkins reloading for the selected week

### Round 5 — Dark Mode (4 commits)

19. **CSS variables color system** — Converted all brand/success/warn/ink Tailwind colors to CSS variables with `<alpha-value>` support. Defined `:root` (light) and `html.dark` (dark) CSS variable sets. Ink scale is inverted in dark mode; brand/success/warn are adjusted for dark readability. Added `darkMode: 'class'` to Tailwind config.
20. **Theme management** — Created `useTheme` hook with localStorage persistence + system preference fallback. `ThemeToggle` component with emoji indicator.
21. **FOUC prevention** — Inline script in `<head>` applies `dark` class before first paint. Dynamic `themeColor` for PWA manifest.
22. **Component dark adaptation** — Applied `dark:` variants to all components: Toast, OfflineBanner, AIFeedbackCard, GoalCard, ErrorBoundary, and all pages (login, new goal, dashboard, report, settings). Cards use `dark:bg-ink-100`; borders use `dark:border-ink-200/300`; special backgrounds (Toasts) maintain dark overlay semantics.

### Round 6 — E2E Tests with Playwright (10 commits)

23. **Dependencies** — Added Playwright as dev dependency. Updated `vitest.config.ts` to exclude `e2e/` directory.
24. **Playwright config** — `playwright.config.ts` with Next.js dev server integration (`webServer`), `chromium` project, and base URL `http://localhost:3000`.
25. **Mock infrastructure** — `e2e/fixtures/mock-server.ts` provides a mock Supabase server that intercepts client-side Supabase calls. `e2e/fixtures/mocks.ts` defines mock API route handlers and test data (user, goals, checkins, weekly reports).
26. **Landing page tests** — Covers unauthenticated landing page: hero section, CTA button, navigation links.
27. **Login page tests** — Covers email magic link flow: input validation, submit button state, success/error UI.
28. **Dashboard tests** — Covers authenticated dashboard: today's goals list, checkin toggle, AI feedback card, empty states.
29. **Goal creation tests** — Covers goal creation form: field validation, persona selection, submit flow, success redirect.
30. **Weekly report tests** — Covers report page: week display, prev/next navigation, persona-aware feedback, empty state.
31. **Settings page tests** — Covers settings: nickname edit, age edit, persona switch, theme toggle, danger zone.
32. **Build info** — Updated `tsconfig.tsbuildinfo`.

### Round 7 — Feature Completion (26 commits)

33. **Goal edit & delete** — Created `/goals/[id]/edit` page (reuses 3-step wizard, prefilled). Added `PATCH`+`DELETE` `/api/goals/[id]` with ownership checks. Goals section in settings page shows active goals with edit links and emoji/streak preview. Soft-delete via `is_active = false`.
34. **Rest day (Skip)** — Added `skip` boolean to checkin POST schema. `POST /api/checkin` with `skip: true` creates `status: "skipped"` record (no AI, no streak change). GoalCard shows "🌴 今天休息" button in all pre-checkin states and `isSkipped` display state.
35. **CSP security header** — Full `Content-Security-Policy` in `next.config.js` covering scripts, styles, images, fonts, connect-src for Supabase + Ark API + Sentry.
36. **Sentry error monitoring** — Installed `@sentry/nextjs` v10. Client/server/edge configs with conditional init (only when `SENTRY_DSN` set). `src/instrumentation.ts` hook. `global-error.tsx` with reset UI and Sentry reporting. `next.config.js` wrapped with `withSentryConfig` (env-driven).
37. **E2E in CI** — GitHub Actions workflow `.github/workflows/e2e.yml`: triggers on push/PR to main/develop, runs `npm ci` → `playwright install` → `playwright test`, uploads artifacts on failure.
38. **Push notifications** — Database table `push_subscriptions` with RLS. `web-push` server-side broadcast utility. Subscribe/unsubscribe API routes. `usePush` client hook with VAPID key handling. Service worker push/notificationclick handlers. Settings page push toggle (switch UI). Cron job sends push notification when goal marked as failed, cleans stale subscriptions.
39. **Screenshot sharing** — `html-to-image` captures AIFeedbackCard as PNG. Share button in feedback modal: tries Web Share API (mobile, with file), falls back to download. Dark mode background matches card.
40. **OG image** — `/api/og` route using `@vercel/og` (`ImageResponse`) with gradient branding. Open Graph + Twitter Card metadata in layout with dynamic OG image URL.
41. **IAP foundation** — `PersonaMeta` type with `isPremium: boolean`. `PRO` badge in persona selector. `/api/iap/products` API (placeholder for Stripe/RevenueCat integration).

## Dark Mode Architecture

| Mechanism         | Detail                                                                                |
| ----------------- | ------------------------------------------------------------------------------------- |
| Strategy          | Tailwind `darkMode: 'class'` + CSS custom properties                                  |
| Color system      | All `bg-ink-N` / `text-ink-N` pick up dark values automatically via CSS var inversion |
| `bg-white`        | Needs explicit `dark:bg-ink-100` (not auto)                                           |
| Theme toggle      | Settings page "外观" section; persists in localStorage                                |
| FOUC prevention   | Inline `<script>` in `<head>` reads localStorage before render                        |
| System preference | Falls back to `prefers-color-scheme` if no stored preference                          |

## Current Project State

| Layer      | Status                                                                |
| ---------- | --------------------------------------------------------------------- |
| TypeScript | Strict mode, compiles clean                                           |
| Schema     | Synced with all 4 migrations (incl. push_subscriptions)               |
| Auth       | Supabase email magic link                                             |
| AI         | Doubao API with dual persona (bro + senpai), premium flag added       |
| PWA        | Service worker + offline checkin queue + push notifications           |
| Cron       | Weekly reports + failed checkin auto-mark + push notification trigger |
| Security   | RLS + CSP + HTTP headers + zod validation + rate limiting             |
| Monitoring | Sentry error tracking (env-driven)                                    |
| CI/CD      | Pre-commit hooks + GitHub Actions E2E workflow                        |
| Tests      | 41 unit tests (3 suites) + 6 E2E specs (Playwright), all passing      |
| UI         | Persona-aware, age editable, goal edit/delete, dark mode, push toggle |

## Recommended Next Steps

### Next Priorities

1. **Wire IAP to payment provider** — Connect `/api/iap` to Stripe/RevenueCat, implement purchase flow, unlock premium personas
2. **Voice support** — TTS audio feedback for AI responses (as planned in README P1)
3. **Friend peer roasting** — Multi-user social accountability (as planned in README P1)
4. **Per-goal checkin reminders** — Individual cron schedules per goal's checkin time
5. **Goal completion/congratulations** — Milestone celebration when best_streak hits certain thresholds

## Key Files Added/Changed This Session

| File                                    | Purpose                                  |
| --------------------------------------- | ---------------------------------------- |
| `src/lib/validations.ts`                | Zod schemas for all API inputs           |
| `src/lib/rateLimit.ts`                  | In-memory sliding window rate limiter    |
| `src/lib/theme.ts`                      | useTheme hook: dark/light persistence    |
| `src/components/ErrorBoundary.tsx`      | React render error fallback              |
| `src/components/ThemeToggle.tsx`        | Dark mode toggle button                  |
| `src/components/AIFeedbackCard.tsx`     | Now persona-aware + dark mode            |
| `src/components/GoalCard.tsx`           | Dark mode border variants                |
| `src/components/Toast.tsx`              | Dark mode bg for overlay                 |
| `src/app/dashboard/page.tsx`            | Loads + passes user persona + dark       |
| `src/app/report/page.tsx`               | Week navigation + dynamic persona        |
| `src/app/settings/page.tsx`             | Editable age + theme toggle              |
| `src/app/layout.tsx`                    | ErrorBoundary + FOUC script + themeColor |
| `src/app/login/page.tsx`                | Terms/privacy links + dark mode          |
| `tailwind.config.js`                    | darkMode:class + CSS var colors          |
| `src/app/globals.css`                   | CSS variables + card/button utilities    |
| `src/__tests__/validations.test.ts`     | 19 validation tests                      |
| `src/__tests__/rateLimit.test.ts`       | 9 rate limiter tests                     |
| `src/__tests__/persona.test.ts`         | 13 persona tests                         |
| `vitest.config.ts`                      | Vitest config (excludes e2e/)            |
| `.husky/pre-commit`                     | Pre-commit hook pipeline                 |
| `playwright.config.ts`                  | Playwright E2E config                    |
| `e2e/fixtures/mock-server.ts`           | Mock Supabase server for E2E             |
| `e2e/fixtures/mocks.ts`                 | Mock API handlers + test data            |
| `e2e/landing.spec.ts`                   | Landing page E2E tests                   |
| `e2e/login.spec.ts`                     | Login page E2E tests                     |
| `e2e/dashboard.spec.ts`                 | Dashboard E2E tests                      |
| `e2e/goals.spec.ts`                     | Goal creation E2E tests                  |
| `e2e/report.spec.ts`                    | Weekly report E2E tests                  |
| `e2e/settings.spec.ts`                  | Settings page E2E tests                  |
| `src/app/goals/[id]/edit/page.tsx`      | Goal edit & delete UI                    |
| `src/app/api/goals/[id]/route.ts`       | Goal update (PATCH) & soft-delete        |
| `src/lib/usePush.ts`                    | Push subscription hook with VAPID        |
| `src/lib/push.ts`                       | Server-side web-push broadcast           |
| `src/app/api/push/subscribe/route.ts`   | Push subscription API                    |
| `src/app/api/og/route.tsx`              | OG image generation via @vercel/og       |
| `src/app/api/iap/products/route.ts`     | IAP products list (placeholder)          |
| `src/instrumentation.ts`                | Sentry instrumentation hook              |
| `src/app/global-error.tsx`              | Global error UI with Sentry reporting    |
| `sentry.client.config.ts`               | Sentry client-side config                |
| `sentry.server.config.ts`               | Sentry server-side config                |
| `sentry.edge.config.ts`                 | Sentry edge runtime config               |
| `.github/workflows/e2e.yml`             | GitHub Actions E2E CI                    |
| `migrations/004_push_subscriptions.sql` | Push subscriptions table migration       |
| `AGENTS.md`                             | AI coding agent project guidance         |
| `handoff.md`                            | This handoff document                    |

## Branch Status

- Branch: `feature/20260729`
- Ahead of `origin/feature/20260729` by 77 commits
- **Not pushed yet** — `git push` needed

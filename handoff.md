# Handoff — 反旗 / FlagBreaker

> Last session: 2026-07-30 | Branch: `feature/20260729`

## What Was Done This Session

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

| Layer      | Status                                                |
| ---------- | ----------------------------------------------------- |
| TypeScript | Strict mode, compiles clean                           |
| Schema     | Synced with all 3 migrations                          |
| Auth       | Supabase email magic link                             |
| AI         | Doubao API with dual persona (bro + senpai)           |
| PWA        | Service worker + offline checkin queue                |
| Cron       | Weekly reports + failed checkin auto-mark             |
| Security   | RLS + HTTP headers + zod validation + rate limiting   |
| Tests      | 41 unit tests, 3 suites, all passing                  |
| CI         | Pre-commit hooks: lint → prettier → type-check → test |
| UI         | Persona-aware, age editable, week nav, dark mode      |

## Recommended Next Steps

### High-Impact

1. **E2E tests with Playwright** — core flow: register → create goal → checkin → AI feedback
2. **CSP header** — `Content-Security-Policy` in `next.config.js` (inline scripts need hashes)
3. **Error monitoring** — Sentry or similar for production crash tracking

### Medium Effort

4. **Social sharing image** — Open Graph image for share cards
5. **IAP monetization** for premium personas (as planned in README P1)

## Key Files Added/Changed This Session

| File                                | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `src/lib/validations.ts`            | Zod schemas for all API inputs           |
| `src/lib/rateLimit.ts`              | In-memory sliding window rate limiter    |
| `src/lib/theme.ts`                  | useTheme hook: dark/light persistence    |
| `src/components/ErrorBoundary.tsx`  | React render error fallback              |
| `src/components/ThemeToggle.tsx`    | Dark mode toggle button                  |
| `src/components/AIFeedbackCard.tsx` | Now persona-aware + dark mode            |
| `src/components/GoalCard.tsx`       | Dark mode border variants                |
| `src/components/Toast.tsx`          | Dark mode bg for overlay                 |
| `src/app/dashboard/page.tsx`        | Loads + passes user persona + dark       |
| `src/app/report/page.tsx`           | Week navigation + dynamic persona        |
| `src/app/settings/page.tsx`         | Editable age + theme toggle              |
| `src/app/layout.tsx`                | ErrorBoundary + FOUC script + themeColor |
| `src/app/login/page.tsx`            | Terms/privacy links + dark mode          |
| `tailwind.config.js`                | darkMode:class + CSS var colors          |
| `src/app/globals.css`               | CSS variables + card/button utilities    |
| `src/__tests__/validations.test.ts` | 19 validation tests                      |
| `src/__tests__/rateLimit.test.ts`   | 9 rate limiter tests                     |
| `src/__tests__/persona.test.ts`     | 13 persona tests                         |
| `vitest.config.ts`                  | Vitest configuration                     |
| `.husky/pre-commit`                 | Pre-commit hook pipeline                 |
| `AGENTS.md`                         | AI coding agent project guidance         |
| `handoff.md`                        | This handoff document                    |

## Branch Status

- Branch: `feature/20260729`
- Ahead of `origin/feature/20260729` by 41 commits
- **Not pushed yet** — `git push` needed

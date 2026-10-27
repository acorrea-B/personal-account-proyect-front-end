# Auth backlog — personal account profile (front-end)

## Context

Web client for the Professional Profile API, auth vertical slice (register → verify → login → refresh → revoke) for a single account holder.
Stack: Next.js App Router (static export) · TypeScript strict · Zod + fetch + React Query · Supabase publishable key · public env vars only.
Expensive decisions: none beyond the already-decided client-side i18n (en/es).

## Backlog

1. As a visitor, I want to register with email and password and land on a clear "verify your email" state, so that I can start my account and know what happens next.
2. As a pending user, I want to request another verification email without revealing whether the account exists, so that I am not blocked by a missed or expired link.
3. As a verified visitor, I want to sign in with email and password, so that I can reach my private workspace.
4. As a signed-in user, I want my session to renew automatically while I am active, so that I am not interrupted by expiring access tokens.
5. As a signed-in user, I want to sign out, so that my session ends immediately on this device.
6. As an unauthenticated visitor, I want private pages to redirect me to login, so that I am prompted to authenticate.
7. As a signed-in user, I want an expired or invalid session to be cleared gracefully, so that I am returned to login instead of seeing broken screens.

## Workspace backlog (next phase)

8. As a signed-in user, I want my workspace to show my profile exactly as the API holds it, so that I always see real data before editing.
9. As a signed-in user, I want to edit my profile with optimistic locking (If-Unmodified-Since), so that concurrent edits cannot silently overwrite each other (412 -> resolve).
10. As a signed-in user, I want to write and read my CV text and browse its version history (at most 10, newest first), so that my CV is safely versioned and recoverable.

## Deferred improvements (post beta 1)

- **Real end-to-end testing service (v2 decision).** The operator ruled out
  manual smoke passes for phase 2; v2 will evaluate an E2E testing service
  driving real flows against production (register → verify → login →
  workspace → profile edit). Until then CI smoke coverage stays where it
  is: unit suite (73 tests) + the deploy pipeline's endpoint smoke.
- **Monitoring and user tracking (v2 decision).** Statistics for the public
  pages: the operator will evaluate monitoring and user-tracking tooling
  (candidate: Google's tools) with privacy-conscious setup. Deliberately not
  this phase; when it lands the export picks the script per the
  secure-typescript-nextjs rules (no secrets client-side).
- **Skills suggestion endpoint (api side).** An api endpoint that suggests
  skills for the signed-in user from what the system already knows: the
  profile's own skills, the CV text corpus and its version history, and the
  client-side catalog. Per plan D15 the flow is consent-gated
  (`profiles.processing_consent`) with the async job pattern (202 + job
  status) and usage quotas; until it exists, the front ships the local
  suggester (detection runs in the browser, the CV text never leaves the
  machine). When it lands, the front swaps the local suggester for the job
  call without touching the workspace layout.

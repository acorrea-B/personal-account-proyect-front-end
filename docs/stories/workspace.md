# Story: workspace profile read (workspace phase, story 8)

## Story

As a signed-in user, I want my workspace to show my profile exactly as the API holds
it, so that I always see real data before editing.

## Acceptance criteria

> Progress note: the read state is wired and unit-covered on the branch
> `feat/workspace-profile`; the live criteria stay gated on the api repository's
> decision about the empty local JWKS finding — the bearer endpoints answer 401
> against local gotrue raw.

- [ ] Given a signed-in user opens the workspace, then the page fetches
      `GET /v1/profile` with the stored access token and renders the real fields.
- [ ] Given the API answers 401, then the invalid session is treated gracefully:
      the session clears and the user lands on `/login/` (auth story 7 reuse).
- [ ] Given a 429/503 or a timeout, then the UI shows a clear retryable message
      and offers retry, without wiping the screen.
- [ ] Given an api response that does not match the contract schema, then the
      render fails closed with a retryable message, never with fake data.
- [ ] Given the update flow (next story), the PUT travels complete with
      `If-Unmodified-Since` and a 412 explains the conflict — deferred here,
      schema already prepared.

## Plan

- Mirror the api profile contract in `lib/schemas/profile.ts` (from
  `src/domain/profile/handlers.rs`): optional fields absent, never null;
  the update schema carries the write-side constraints (full_name 1..200
  after trim, headline/location 120, bio 2000, links 10 {type 40, url
  http(s)}, skills 30 x 40 case-insensitive unique).
- Add `fetchProfile(accessToken)` to `lib/api/profile.ts` (GET + Bearer +
  time-bounded fetch, problem+json -> ProblemError).
- Cover schema and client behaviour with unit tests (fetch stubbed).
- Wire the `/app` workspace read state: loading, ready render of the real
  fields (headline/name/bio/location/skills/links), a 401 that clears the
  session and lands on `/login/` (story 7 reuse), retryable messages with a
  Try again action, and a fail-closed path for out-of-contract responses.
- Defer the PUT flow, the CV text editor and version history to stories
  9 and 10 of the backlog.

## Findings recorded while starting this story (live api, 2026-10-27)

- The dev stack's verification email links do not verify: the token inside the
  sent link does not hash to the stored `confirmation_token` (gotrue answers
  `access_denied: Email link is invalid or has expired`). Escalated to the api
  repository; while unresolved, dev-stack test accounts get verified by SQL —
  although the api's own `DEV_PRINT_CONFIRMATION_LINK=true` works: the printed
  link verified an account end to end (register 201 -> verify 200 -> login).
  Mixed local/cloud stacks explain most of the earlier noise: the `.env` of the
  api pointed to the cloud beta project while gotrue ran locally.
- The `.env` of the api pointed `SUPABASE_URL`/`JWKS`/`DATABASE_URL` to the
  cloud beta project, so `probe-e2e` (born in local gotrue) answered
  invalid-credentials and the register flow hit the cloud email quota (429).
  Fixed by restoring the coherent local stack of `.env.example` (the cloud
  values stay commented as `# beta:` lines); the browser flow now works:
  register 201, allow-origin on every response, login with tokens.
- The bearer endpoints (`/v1/profile`, `/v1/cv/*`) still answer 401 against
  the local gotrue raw because it serves an EMPTY jwks (`keys: []`, symmetric
  keys never publish) and the api verifies exclusively through the
  `JwksVerifier`. This is the documented local limitation of the api
  (its `docs/learned.md`): locally the protected flows run with the HS256
  verifier of `AppState::for_tests()`, and CI uses the cloud JWKS. The api
  repository must decide: an env-driven verifier for local development or
  run the E2E against the cloud beta (cap: ~2 registration emails per hour).

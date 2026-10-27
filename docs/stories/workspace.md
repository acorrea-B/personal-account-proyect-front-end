# Story: workspace profile read (workspace phase, story 8)

## Story

As a signed-in user, I want my workspace to show my profile exactly as the API holds
it, so that I always see real data before editing.

## Acceptance criteria

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
- Wire the `/app` workspace read state in a followup commit of this story.
- Defer the PUT flow, the CV text editor and version history to stories
  9 and 10 of the backlog.

## Findings recorded while starting this story (live api, 2026-10-27)

- The dev stack's verification email links do not verify: the token inside the
  sent link does not hash to the stored `confirmation_token` (gotrue answers
  `access_denied: Email link is invalid or has expired`). Escalated to the api
  repository; while unresolved, dev-stack test accounts get verified by SQL.
- The api rejected every Bearer credential: the `.env` carried no
  `SUPABASE_JWT_SECRET`, so the api verified against a fallback secret while
  gotrue signs with the compose one. Fixed by adding it; the api process needs
  a restart to pick it up.

# Story: workspace profile read (workspace phase, story 8)

## Story

As a signed-in user, I want my workspace to show my profile exactly as the API holds
it, so that I always see real data before editing.

## Acceptance criteria

> Progress note: the read state is wired and unit-covered on the branch
> `feat/workspace-profile`; the live criteria stay gated on the api repository's
> decision about the empty local JWKS finding — the bearer endpoints answer 401
> against local gotrue raw. A 401 on the READ keeps the session (one silent
> renewal is attempted) and surfaces a retryable message instead of clearing
> the session — a read failure is not a session event. The session
> destruction path belongs to the auth layer (login/refresh failure).

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
  fields (headline/name/bio/location/skills/links), retryable messages with a
  Try again action, and a fail-closed path for out-of-contract responses. A
  401 on the read attempts one silent refresh and then keeps the session —
  it never clears it (the clearing belongs to the auth layer, story 7).
- Defer the PUT flow, the CV text editor and version history to stories
  9 and 10 of the backlog.

## Story 9 progress (complete-your-profile, in flight)

- The live contract of the PUT was proven against the local api before the
  schema landed: a complete write answers **200 with the refreshed profile**,
  and a stale write answers **412 with `current_updated_at`**.
- `updateProfile` + `isProfileIncomplete` landed in `lib/api/profile.ts`
  (unit-covered).
- `/app` now gates the seeded `User` placeholder into `/app/profile/`, the
  setup form (full_name, headline, bio, location); the PUT travels complete,
  so the enrichments the api holds (links/skills) are sent back preserved
  until their editors land in a followup.
- The setup flow loads real data, saves with the optimistic header (200 ->
  saved + Open workspace), reloads the latest on 412 with an explanatory
  note, and surfaces 429/503/timeout as retryable messages. Live criteria
  now run GREEN against the local stack (`JWT_VERIFY_MODE=hs256`).

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

## Two write flows share the endpoint (2026-10-27)

`PUT /v1/profile` is one endpoint (a complete PUT with the optimistic
header), but the two flows that call it are not the same flow:

- **Complete your profile** (onboarding): the workspace redirects the
  seeded `User` placeholder here. It demands only a real name; every
  optional field is allowed to stay empty. The registration stepper and
  the placeholder kicker belong to this flow alone; after the save the
  handoff is the toast plus "Open workspace".
- **Update profile** (maintenance): reached from the workspace menu. Its
  background validations keep the profile valid for the dashboard: the
  name can neither be emptied nor be the placeholder (a 200 that
  reinstalls 'User' would silently re-qualify the profile as incomplete
  and re-gate the workspace), and the name field marks live while its
  condition is unmet. No stepper, no placeholder talk; the button reads
  "Save changes" and the copy names the complete-PUT semantics.

The flow derives once from the loaded profile (`profileWriteFlow`), is
frozen for the page's lifetime and both rules are unit-covered in
`tests/profile-flows.test.ts` (`fullNameProblem` per flow).

## The update flow opens inside the dashboard shell (2026-10-27)

The update-profile view is part of the dashboard's flow, so it lost its
ad-hoc header (the "Signed in as ..." subtitle and the bare Sign out
button) and now opens under the dashboard's identity bar with the
Account menu at the top:

- the Account menu moved to `components/account-menu.tsx` (shared by
  the dashboard and the update flow, same click-outside/Escape rules)
- the update card keeps its own h1 (Update profile); the bar's title
  is a paragraph so the page keeps exactly one h1
- the onboarding flow keeps its registration card as it was

## The way back is persistent (2026-10-27)

The save toast pinned bottom-center could ride over the actions row,
and the only escape link lived and died with it (5 seconds). The
update flow now carries its exits permanently:

- the actions row keeps a persistent "Back to workspace" ghost button
  (HomeIcon + text) next to Save changes
- the dashboard bar gains an icon-only home action beside the Account
  menu (the navigation contract: an `<a>`, aria-label, focus-visible)
- the toast anchors to the bottom-right corner, off the centered
  actions row; the onboarding handoff still opens with the toast

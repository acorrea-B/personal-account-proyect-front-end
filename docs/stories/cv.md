# Story: write and read the CV with version history

## Story

**US4 (backlog item 10).** As a signed-in user, I want to write and read my
CV text and browse its version history (at most 10, newest first), so that
my CV is safely versioned and recoverable.

## Contract (specs/001-beta-profile-api — implemented in the api)

| Endpoint                   | Semantics                                                   | Notes for the front                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/cv/text`          | 200 `CvEnvelope{cv}`                                        | **404 = the user has no CV yet** → empty state, not an error                                                                                                                 |
| `POST /v1/cv/text`         | 201 `CvSaveResponse{cv: CvMeta, previous_version_archived}` | `If-Unmodified-Since` **optional** (first save sends none); 412 `stale-version` carries `current_updated_at`; 413 `cv-too-large` carries `max_bytes`; rate limit 10/min (R2) |
| `GET /v1/cv/versions`      | 200 `CvVersionsEnvelope`                                    | ≤10, newest first, `VersionSummary{id, origin, archived_at}`                                                                                                                 |
| `GET /v1/cv/versions/{id}` | 200 `CvVersionEnvelope`                                     | 404 also masks other users' ids (anti BOLA) — same "not found" treatment                                                                                                     |

Constraints: UTF-8 ≤ 51200 bytes (51200 exact accepted), content travels
verbatim (no trim/normalization), saving empty content clears the CV (no
client-side min length was invented).

## v0.4 queue (one minor for the feature; each batch = one deploy + tag)

| Batch | Windows                                                                                                                                                                                                                                                                     | Tag      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | 1) contract mirror + text client (`lib/schemas/cv.ts`, `lib/api/cv.ts`, tests) · 2) read the cv in the dashboard (the "Coming up: CV editor" rail card turns real) · 3) editor: textarea, 50KB counter, 10/min rate-limit UX, save with If-Unmodified-Since and 412 resolve | `v0.4.0` |
| 2     | 4) version history list (≤10, newest first) · 5) version recovery (read a past version, re-save it)                                                                                                                                                                         | `v0.4.1` |
| 3     | 6) polish: cv panel skeleton, error/retry states, `origin` marker on version rows                                                                                                                                                                                           | `v0.4.2` |

After the feature batches (operator set the tags): a patch for
**OG/canonical/robots** (`v0.4.4`) and one for the **security headers
review** (`v0.4.5`).

## Progress

- 2026-10-27: window 1 landed — contract mirror + text read/save client,
  13 unit tests (86 total), rate limit and size limits surfaced as typed
  `ProblemError`s.

### Window 2 (2026-10-27): the cv card lives in the dashboard rail

The "CV editor · Planned next" card left the rail: the dashboard fetches
`GET /v1/cv/text` in parallel with the profile (the profile panel never
waits on the cv) and `components/cv-card.tsx` renders the four states —
loading (skeleton), ready (`ClampedText` at 3 lines + last-saved meta +
"Live" chip), empty (404 = "No cv yet"), and error with its own retry
button. The cv read keeps the read rule: it never destroys the session,
429 explains the rate cap (10/min), 401 keeps the session framing. The
editor entry point rides window 3 and turns this card into its hub.

### Window 3 (2026-10-27): the editor opens under the dashboard bar

`app/app/cv/` gets the real editor: the dashboard shell (identity bar +
Account menu) wraps an `auth-card` with the tall textarea (auth-card input
rules inherited), the tabular byte counter (alert past the contract limit,
submit disabled while over) and the save flow with every contract answer —
201 refreshes the meta and flashes the viewport toast ("the previous
version moved to the history when there was one"), 412 keeps the user's
draft untouched (no silent replacement) and hands the explicit "reload the
latest version" button, 413 names the byte ceiling, 429 explains the rate
cap. The persistent way back (Back to workspace, never tied to the toast)
rides the actions row. On the rail, the cv card gains its visible entry
buttons: "Edit CV" when a cv exists, "Write your CV" on the empty state.

### Rail decision (2026-10-27, operator): no document reader in the rail

The unfolded "Show more" over a 51KB cv broke the rail visually. The card
now shows a hard 280-char truncation (paragraph breaks preserved, ellipsis,
no unfold control) - the full text lives one click away in the editor.
Planned evolution: the api will eventually serve the cv structured (html or
equivalent) so the front can mount a full dynamic cv page; the rail stays
a compact hub and the page becomes the reader. That api evolution rides the
backend backlog, not this front stack.

### Window 4 (2026-10-27): the versions client

`lib/api/cv.ts` gains `getVersions` (the ≤10 summaries, newest first) and
`getVersionDetail` (summary + content) with their envelope schemas; 6 new
tests (94 total) cover the empty first-time list, the id path segment and
the anti-BOLA 404 that the api uses to mask other users' versions.

### Window 5 (2026-10-27): the version timeline lands in the rail

The "Version history · Planned" card became real: `components/cv-timeline.tsx`
renders the timeline of the archived versions newest first — a vertical
spine with dots and short en-US stamps (minutes visible; the Intl zone is
the user's at runtime, the tests pin UTC for determinism). Empty state
answering the first-time saver, error with its own retry. The entries stay
plain rows until the detail dialog turns them interactive (window 6).
The vitest harness gained the `@` alias map and a TZ=UTC pin, so
component tests share the app vocabulary and dates stay deterministic.

### Window 6 (2026-10-27): the version detail dialog and restore

The timeline rows turn interactive: each entry opens a reading panel over
the dashboard (`components/cv-version-detail.tsx`) — backdrop with blur,
Escape/backdrop-click/✕ close, initial focus on the close button, body
scroll locked while open. The content reads like the document the cv is
(pre-wrap, its own scroll on a stone-canvas paper). "Restore this version"
performs a contract save of the archived content with the current
updated_at as the optimistic reference: 201 refreshes the dashboard (cv
card and history reload), 412 (concurrent write) keeps the panel open with
explicit instructions instead of guessing, 429 carries the rate-cap voice.
Entries without a handler stay honest plain rows (the window-5 fallback).

### History accent (2026-10-27, operator): teal as the only second hue

The dashboard had drifted to blue-and-white everywhere and the eye glyph
read wrong for "view a version". Two moves together: the action glyph is a
history clock (rewind arc + hands, inline svg so the window file budget
holds), and the palette gains a second feature accent - teal (#0f766e,
white on it ≈5.5:1, above the 3:1 non-text bar) - scoped to the version
timeline only: dots, the view circle and its hover/step stay teal while
every other surface keeps the cyan identity. Token trio documented in
:root (--color-teal-text/-strong/-wash).

### v0.4.3 window 1 (2026-10-27): the sign-out wiring, caught by the first component test

Operator report: sign out did nothing. Not the lib - the wiring: the
AccountMenu called `signOut()` in place, which clears storage but leaves
the mounted dashboard holding its in-memory session (looking signed in,
with a revoked token behind it). The menu now navigates to `/logout/`,
which owns revoke + clear + redirect. The fix is guarded by the repo's
first component test (jsdom + esbuild automatic jsx + act environment +
the @ alias map) - the harness pieces the component suite needed all
along.

### v0.4.3 window 2 (2026-10-27): the panel polish

The rail card speaks human dates ("Last saved Oct 26, 9:03 AM" through the
timeline's formatWhen) instead of the raw ISO timestamp, and the version
detail panel shows the provencia marker the contract reserved (D15): the
eyebrow reads "Version history · archived · origin user".

### v0.4.3 window 2 (2026-10-27): the panel polish

The rail card speaks human dates ("Last saved Oct 26, 9:03 AM" through the
timeline's formatWhen) instead of the raw ISO timestamp, and the version
detail panel carries the provenance marker the contract reserved (D15) on
its own line once the detail is ready: "origin user".

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

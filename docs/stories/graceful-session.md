# Story: graceful expired session (auth phase, story 7)

## Story

As a signed-in user, I want an expired or invalid session to be cleared gracefully, so that I am returned to login instead of seeing broken screens.

## Acceptance criteria

- [x] Given a stored access token but an expired refresh token, then bootstrap clears the session and redirects to `/login/`.
- [x] Given an invalid or reused refresh token (401), then the session is cleared immediately.
- [x] Given a transient failure, then the current stored session remains available until a hard auth failure occurs.
- [x] No partial/broken token remains in sessionStorage after a 401.

## Plan

- Revalidate and renew the session during client bootstrap.
- Treat 401 refresh failures as session-clearing auth failures.
- Let `useRequireAuth` redirect once the session becomes null.

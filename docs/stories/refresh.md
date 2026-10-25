# Story: refresh (auth phase, story 4)

## Story

As a signed-in user, I want my session to renew automatically while I am active, so that I am not interrupted by expiring access tokens.

## Acceptance criteria

- [x] Given a valid stored refresh token, when the access token is close to expiry or page mounts, then the client exchanges it transparently and stores the new token pair.
- [x] Given an invalid or reused refresh token (401), then the client clears the session and returns the user to login.
- [x] Given a transient failure or network timeout, then the client retries later without clearing the session on the first failure.
- [x] Given successful renewal, no access token is written to the URL or to non-session storage.
- [x] Automatic refresh does not block screen rendering.

## Plan

- Add refresh request and reuse the token pair schema.
- Add a thin `refresh()` API client call.
- Add `refreshSession()` sanitizer/refresh helper in `lib/auth/session.ts`.
- Add a `useSession` hook to restore and renew sessions.
- Add automated coverage for schema and client calls; defer route protection UI.

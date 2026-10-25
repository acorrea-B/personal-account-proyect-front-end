# Story: logout (auth phase, story 5)

## Story

As a signed-in user, I want to sign out, so that my session ends immediately on this device.

## Acceptance criteria

- [x] Given a signed-in user submits logout, then the app calls revoke with the current access token and clears the refresh token from sessionStorage.
- [x] Given revoke succeeds (204), then the user is redirected to `/login/`.
- [x] Given revoke returns 401/429/503, then the client still clears local session and returns to `/login/` without leaking tokens.
- [x] Logout works even if the session is partially missing.
- [x] No token is exposed in the redirect URL.

## Plan

- Add an empty/object revoke request schema or reuse an empty object.
- Add a `revoke()` API client call with bearer authorization.
- Add a `signOut()` helper that revokes then always clears storage.
- Implement a `/logout/` route with pending state and redirect.
- Add client test coverage.

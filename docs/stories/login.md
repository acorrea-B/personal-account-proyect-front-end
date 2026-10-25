# Story: login (auth phase, story 3)

## Story

As a verified visitor, I want to sign in with email and password, so that I can reach my private workspace.

## Acceptance criteria

- [x] Given a visitor submits valid credentials, then the API returns a token pair and the refresh token is stored in sessionStorage; no token is exposed through the URL.
- [x] Given a visitor submits invalid credentials, then the UI shows one generic, non-leaking invalid-credentials message.
- [x] Given a visitor submits credentials for an unverified account (403 email-not-verified), then the UI explains the next step and links to `/register/confirm/`.
- [x] Given a 429/503 or timeout, then the UI shows a clear retryable message and does not store stale session data.
- [x] Given successful login, then the visitor is redirected to the private workspace (`/`), without final visual styling.

## Plan

- Add login request and token pair schemas, plus TypeScript types.
- Add a thin `login()` API client call and a session storage helper.
- Implement the login form with POST method, pending states, and error mapping.
- Add automated coverage for schemas and client calls.
- Defer automatic refresh, logout, route protection, and styling to later stories.

# Story: register (auth phase, story 1)

## Story

As a visitor, I want to register with email and password and be redirected to a dedicated "confirm your email" view, so that I know I must verify my email before continuing.

## Acceptance criteria

- [x] Given a visitor on the registration form, when they submit a valid email and password, then the app creates the account and redirects to a dedicated "confirm your email" view with non-sensitive instructions; no credentials are stored.
- [x] Given a visitor submits an email that already exists, when the API responds 409 email-exists, then they see a clear, non-leaking conflict message and stay on the form (no redirect).
- [x] Given a visitor submits a malformed email or a weak password, when client or API validation fails (422), then field-level errors are shown and no redirect or session state occurs.

## Plan

- Add the minimal typed client transport and Zod schemas needed for registration.
- Implement the registration form with client-side validation and submission states.
- On success, route to a dedicated "confirm your email" view that shows only non-sensitive instructions and a clear next step.
- Map the RFC 7807 Problem to localized user-facing copy for conflict/validation failures.
- Add behavior-first tests for schemas/problem mapping and the success redirect path.

## Out of scope

- Requesting another verification email (story 2), even though the confirmation view may link to it.
- Login/session creation and route protection (stories 3–7).
- Refresh/revoke and concurrency behavior.
- Full design-token/component system beyond what this form and view need.

## Suggestions (your call)

- Keep the confirmation view stateless and derive its email display from the registration response's normalized `email` (non-sensitive in this context), not from client input.
- Keep the HTTP client deliberately thin; introduce an auth context/provider only when login (story 3) proves it needed.
- Introduce `ProblemAlert` only if it stays small and inline; otherwise reuse a minimal alert until a second consumer exists.

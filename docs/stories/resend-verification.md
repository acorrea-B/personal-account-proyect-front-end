# Story: resend verification (auth phase, story 2)

## Story

As a pending user, I want to request another verification email through a generic, account-neutral response, so that a missed or expired link does not block my registration.

## Acceptance criteria

- [x] Given a visitor with a valid email on the resend form, when they submit it, then the app shows the same generic confirmation regardless of whether the account exists or is pending, and leaks no account state.
- [x] Given a visitor submits a malformed email, when client or API validation fails (422), then field-level feedback is shown and no network success state is implied.
- [x] Given the resend endpoint responds 429 or 503, when the failure occurs, then the user sees a clear, non-leaking message and can retry according to the provided reason.
- [x] Given a visitor successfully requests a resend, when the request completes, then the resend action is disabled for 3 minutes and displays a countdown; after expiry, the action can be invoked again.
- [x] Given the resend endpoint responds 429, then the UI warns the user and redirects them to `/register/`.

## Plan

- Add the minimal resend request schema and one resendVerification client call.
- Implement a stateless resend form route that validates email client-side.
- Map email-malformed, rate-limited and dependency-unavailable to concise user-facing copy.
- Keep the existing /register/confirm/ view as the handoff and link to this resend action.
- Add behavior-first tests for schema and success/error client mapping.

## Out of scope

- Login, session and route protection (story 3).
- Automatic email prefill from registration response.
- Retry/backoff UX beyond a simple, clear retry message.
- Visual styling and localization polish.

## Suggestions (your call)

- Keep the resend response generic in UI even when the API returns 200, so existence can never be inferred from screen behavior.
- Reuse the thin client and ProblemError from story 1 instead of creating a second transport.
- If a simple countdown/link is needed for retry, defer it until the rate-limit hint proves repetitive.

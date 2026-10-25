# Story: route protection (auth phase, story 6)

## Story

As an unauthenticated visitor, I want private pages to redirect me to login, so that I am prompted to authenticate.

## Acceptance criteria

- [x] Given a visitor without a session opens `/`, then they are redirected to `/login/`.
- [x] Given a visitor with a stored valid session, then `/` renders without an authentication redirect.
- [x] The redirect waits for client hydration to avoid false redirects.
- [x] The private route does not parse or expose tokens in the URL.

## Plan

- Add a `useRequireAuth` client hook built on `useSession`.
- Replace the home page with a guarded client view.
- Keep public (`/login`, `/register`) routes unaffected.

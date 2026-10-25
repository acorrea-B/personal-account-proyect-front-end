# Auth backlog — personal account profile (front-end)

## Context

Web client for the Professional Profile API, auth vertical slice (register → verify → login → refresh → revoke) for a single account holder.
Stack: Next.js App Router (static export) · TypeScript strict · Zod + fetch + React Query · Supabase publishable key · public env vars only.
Expensive decisions: none beyond the already-decided client-side i18n (en/es).

## Backlog

1. As a visitor, I want to register with email and password and land on a clear "verify your email" state, so that I can start my account and know what happens next.
2. As a pending user, I want to request another verification email without revealing whether the account exists, so that I am not blocked by a missed or expired link.
3. As a verified visitor, I want to sign in with email and password, so that I can reach my private workspace.
4. As a signed-in user, I want my session to renew automatically while I am active, so that I am not interrupted by expiring access tokens.
5. As a signed-in user, I want to sign out, so that my session ends immediately on this device.
6. As an unauthenticated visitor, I want private pages to redirect me to login, so that I am prompted to authenticate.
7. As a signed-in user, I want an expired or invalid session to be cleared gracefully, so that I am returned to login instead of seeing broken screens.

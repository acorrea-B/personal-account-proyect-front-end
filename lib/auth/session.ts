import { ProblemError, refresh, revoke } from '../api/client';
import { userSchema, type TokenPair, tokenPairSchema } from '../schemas/auth';

export const ACCESS_TOKEN_KEY = 'auth.accessToken';
export const REFRESH_TOKEN_KEY = 'auth.refreshToken';
export const USER_KEY = 'auth.user';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: TokenPair['user'];
}

export function saveSession(tokenPair: TokenPair): AuthSession {
  const parsedPair = tokenPairSchema.parse(tokenPair);
  const session: AuthSession = {
    accessToken: parsedPair.access_token,
    refreshToken: parsedPair.refresh_token,
    user: userSchema.parse(parsedPair.user),
  };
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
  return session;
}

export function loadSession(): AuthSession | null {
  const accessToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  const userRaw = window.sessionStorage.getItem(USER_KEY);
  if (!accessToken || !refreshToken || !userRaw) {
    return null;
  }
  try {
    const user = userSchema.parse(JSON.parse(userRaw));
    return { accessToken, refreshToken, user };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

// Single-flight guard: gotrue rotates the refresh token with reuse-kill, so
// parallel callers sharing one token would invalidate the whole session
// family. Every caller of refreshSession awaits the same in-flight promise.
let inFlightRefresh: Promise<AuthSession | null> | null = null;

export async function refreshSession(
  session: AuthSession | null = loadSession(),
): Promise<AuthSession | null> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const run = (async () => {
    const current = session ?? loadSession();
    if (!current) {
      return null;
    }

    try {
      const tokenPair = await refresh({ refresh_token: current.refreshToken });
      return saveSession(tokenPair);
    } catch (error) {
      if (error instanceof ProblemError && error.problem.status === 401) {
        clearSession();
        return null;
      }
      throw error;
    }
  })();

  inFlightRefresh = run;
  try {
    return await run;
  } finally {
    inFlightRefresh = null;
  }
}

export async function signOut(): Promise<void> {
  const session = loadSession();
  if (session?.accessToken) {
    try {
      await revoke(session.accessToken);
    } catch {
      // Always clear locally, even when revoke fails.
    }
  }
  clearSession();
}

// Cross-view handoff for the unverified-email flow (static export: pages
// communicate through sessionStorage, never through query params). The
// helpers are SSR-safe: during prerendering there is no window and they
// degrade to no-ops so pages can still render.
export const PENDING_VERIFICATION_EMAIL_KEY = 'auth.pendingVerificationEmail';

export function savePendingVerificationEmail(email: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email);
}

export function readPendingVerificationEmail(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) ?? '';
}

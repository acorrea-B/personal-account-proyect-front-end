import { userSchema, type TokenPair } from '../schemas/auth';

export const ACCESS_TOKEN_KEY = 'auth.accessToken';
export const REFRESH_TOKEN_KEY = 'auth.refreshToken';
export const USER_KEY = 'auth.user';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: TokenPair['user'];
}

export function saveSession(tokenPair: TokenPair): AuthSession {
  const session: AuthSession = {
    accessToken: tokenPair.access_token,
    refreshToken: tokenPair.refresh_token,
    user: userSchema.parse(tokenPair.user),
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

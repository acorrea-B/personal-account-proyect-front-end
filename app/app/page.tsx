'use client';

import { useRequireAuth } from '../../lib/auth/useRequireAuth';

export default function AppHomePage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();

  if (!isHydrated || !isAuthorized) {
    return (
      <main className="auth-page">
        <p className="auth-subtitle loading-state">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card">
        <h1 className="auth-heading">Professional Profile</h1>
        <p className="auth-subtitle">Private profile and CV management.</p>
        <p className="auth-subtitle">Signed in as {session?.user.email}</p>
        <a className="link" href="/logout/">
          Sign out
        </a>
      </section>
    </main>
  );
}

'use client';

import { useRequireAuth } from '../lib/auth/useRequireAuth';

export default function HomePage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();

  if (!isHydrated || !isAuthorized) {
    return (
      <main>
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Professional Profile</h1>
      <p>Private profile and CV management.</p>
      <p>Signed in as {session?.user.email}</p>
      <a href="/logout/">Sign out</a>
    </main>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { signOut } from '@/lib/auth/session';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    void signOut().finally(() => {
      router.replace('/login/');
    });
  }, [router]);

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card">
        <h1 className="auth-heading">Signing out</h1>
        <p className="auth-subtitle">Ending your session on this device.</p>
      </section>
    </main>
  );
}

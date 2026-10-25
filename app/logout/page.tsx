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
    <main>
      <section>
        <h1>Signing out</h1>
        <p>Ending your session on this device.</p>
      </section>
    </main>
  );
}

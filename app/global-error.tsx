'use client';

import NextError from 'next/error';
import { useEffect } from 'react';
import posthog from 'posthog-js';

import { initializePostHog } from '@/components/posthog-init';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (initializePostHog()) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}

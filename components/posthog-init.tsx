'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

import { loadSession } from '@/lib/auth/session';

let initialized = false;

export function initializePostHog(): boolean {
  if (initialized) {
    return true;
  }

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      );
    }

    return false;
  }

  if (!host) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        'NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured',
      );
    }

    return false;
  }

  posthog.init(projectToken, {
    api_host: host,
    defaults: '2026-08-30',
    capture_exceptions: true,
    logs: {
      serviceName: 'personal-account-frontend',
      environment: process.env.NODE_ENV ?? 'production',
    },
  });
  initialized = true;
  return true;
}

export function PostHogInit() {
  useEffect(() => {
    if (!initializePostHog()) {
      return;
    }

    const session = loadSession();
    if (session) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        verified: session.user.verified,
        created_at: session.user.created_at,
      });
    }
  }, []);

  return null;
}

'use client';

import posthog from 'posthog-js';

type LogAttributes = Record<string, boolean | number | string>;

function isPostHogConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
  );
}

export const posthogLog = {
  info(body: string, attributes: LogAttributes) {
    if (!isPostHogConfigured()) {
      return;
    }

    posthog.logger.info(body, attributes);
  },
};

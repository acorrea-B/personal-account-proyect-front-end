'use client';

import { useEffect, useRef, useState } from 'react';

import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import type { SuggestionsSummary } from '@/lib/schemas/suggestions';

// The CV suggestions revision the user already walked through in the
// profile tour. The backend count of CV suggestions does not fall until
// BC-013 adds their decisions, so a walked revision stops counting here;
// a new revision counts again. A per-viewer convenience only: storage may
// be unavailable (private mode), and then the revision simply counts.
export const seenCvRevisionKey = 'profile.tour.seenCvRevision';

export function readSeenCvRevision(): string | null {
  try {
    return window.localStorage.getItem(seenCvRevisionKey);
  } catch {
    return null;
  }
}

export function markCvRevisionSeen(revisionId: string): void {
  try {
    window.localStorage.setItem(seenCvRevisionKey, revisionId);
  } catch {
    // Storage blocked: the marker shows again next visit, nothing breaks.
  }
}

// What still waits for the user in the profile: the pending skill
// suggestions, plus the CV suggestions of a revision not walked yet.
export function pendingCount(summary: SuggestionsSummary, seenCvRevision: string | null): number {
  const cv =
    summary.cv.revision_id && summary.cv.revision_id !== seenCvRevision ? summary.cv.pending : 0;
  return summary.skills.pending + cv;
}

// The pending count for the menu marker; 0 while loading, without a
// session, or when the summary cannot be read (the marker is a hint, never
// an error). Reads once per mount.
export function usePendingSuggestions(accessToken: string | null): number {
  const [count, setCount] = useState(0);
  // The token renews in the background; the marker reads once per page.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const hasToken = accessToken !== null;
  useEffect(() => {
    const token = tokenRef.current;
    if (!hasToken || !token) {
      return;
    }
    let live = true;
    // Started inside the chain, so even a synchronous failure stays a
    // rejection the marker swallows.
    Promise.resolve()
      .then(() => fetchSuggestionsSummary(token))
      .then((summary) => {
        if (live) {
          setCount(pendingCount(summary, readSeenCvRevision()));
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [hasToken]);
  return count;
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { loadSession, sessionSavedEvent } from '@/lib/auth/session';
import type { SuggestionsSummary } from '@/lib/schemas/suggestions';

// Announced after the user decides a suggestion, so every view that counts
// pending suggestions (the menu marker) reads the summary again.
export const suggestionsChangedEvent = 'profile:suggestions-changed';

export function announceSuggestionsChanged(): void {
  window.dispatchEvent(new Event(suggestionsChangedEvent));
}

// The CV suggestions revision the user already walked in the profile tour.
// The backend count of CV suggestions does not fall until BC-013 adds their
// decisions, so the tour remembers the walked revision per viewer and does
// not offer it again; a new revision is offered. A convenience only:
// storage may be unavailable (private mode), and then it is offered again.
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
    // Storage blocked: the tour is offered again next visit, nothing breaks.
  }
}

// What waits for the user in the profile: the pending skill suggestions,
// plus the CV suggestions of a revision the tour has not walked yet.
export function pendingCount(
  summary: SuggestionsSummary,
  seenCvRevision: string | null = null,
): number {
  const cv =
    summary.cv.revision_id && summary.cv.revision_id !== seenCvRevision ? summary.cv.pending : 0;
  return summary.skills.pending + cv;
}

// The pending count for the menu marker. It reads the stored session
// without starting a session lifecycle of its own: the page owns token
// refresh, and a second lifecycle would rotate the refresh token under it.
// 0 without a session or when the summary cannot be read (the marker is a
// hint, never an error); read on mount, after each decision or walked tour,
// and whenever the page stores a refreshed session.
export function usePendingSuggestions(): number {
  const [count, setCount] = useState(0);

  const read = useCallback(() => {
    const token = loadSession()?.accessToken;
    if (!token) {
      return () => undefined;
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
  }, []);

  useEffect(() => {
    let cancel = read();
    const onChange = () => {
      cancel();
      cancel = read();
    };
    // A refreshed session (the page renewing an expired token) and a
    // decision both mean the count may have changed.
    window.addEventListener(suggestionsChangedEvent, onChange);
    window.addEventListener(sessionSavedEvent, onChange);
    return () => {
      cancel();
      window.removeEventListener(suggestionsChangedEvent, onChange);
      window.removeEventListener(sessionSavedEvent, onChange);
    };
  }, [read]);

  return count;
}

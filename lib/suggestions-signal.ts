'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { loadSession } from '@/lib/auth/session';
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

// What waits for the user in the profile: the pending skill suggestions.
export function pendingCount(summary: SuggestionsSummary): number {
  return summary.skills.pending;
}

// The pending count for the menu marker. It reads the stored session
// without starting a session lifecycle of its own: the page owns token
// refresh, and a second lifecycle would rotate the refresh token under it.
// 0 without a session or when the summary cannot be read (the marker is a
// hint, never an error); read on mount and again after each decision.
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
          setCount(pendingCount(summary));
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
    window.addEventListener(suggestionsChangedEvent, onChange);
    return () => {
      cancel();
      window.removeEventListener(suggestionsChangedEvent, onChange);
    };
  }, [read]);

  return count;
}

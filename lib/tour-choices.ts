'use client';

// The improvements the user chose in the profile tour, per CV suggestions
// revision: which suggestions to apply to the next CV version and which to
// skip. Kept per viewer until the backend records CV suggestion decisions
// (BC-013) and the harness can build the ATS version from them; storage
// may be unavailable (private mode), and then nothing is remembered.
export type TourChoice = 'apply' | 'skip';
export type TourChoices = Record<string, TourChoice>;

export const tourChoicesKey = 'profile.tour.cvChoices';

export function readTourChoices(revisionId: string | null): TourChoices {
  if (!revisionId) {
    return {};
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(tourChoicesKey) ?? 'null') as {
      revision?: unknown;
      choices?: unknown;
    } | null;
    if (stored?.revision !== revisionId || typeof stored.choices !== 'object' || !stored.choices) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored.choices as Record<string, unknown>).filter(
        (entry): entry is [string, TourChoice] => entry[1] === 'apply' || entry[1] === 'skip',
      ),
    );
  } catch {
    return {};
  }
}

export function saveTourChoices(revisionId: string | null, choices: TourChoices): void {
  if (!revisionId) {
    return;
  }
  try {
    window.localStorage.setItem(tourChoicesKey, JSON.stringify({ revision: revisionId, choices }));
  } catch {
    // Storage blocked: the choices last for this visit only.
  }
}

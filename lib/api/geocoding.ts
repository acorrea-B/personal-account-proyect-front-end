import { z } from 'zod';

// Open-Meteo geocoding (https, public, CORS enabled): the source for the
// location autocomplete, so the field ends with an exact place value
// ("City, Region, Country"). The feature degrades silently: any failure
// yields an empty suggestion list and never breaks the form.

const geocodingResultSchema = z.object({
  name: z.string().min(1),
  admin1: z.string().optional(),
  country: z.string().optional(),
});

const geocodingResponseSchema = z.object({
  results: z.array(geocodingResultSchema).optional(),
});

export interface CitySuggestion {
  label: string;
}

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MIN_QUERY_LENGTH = 2;
const SEARCH_TIMEOUT_MS = 8000;

export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const url = `${SEARCH_URL}?name=${encodeURIComponent(trimmed)}&count=5&language=en&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return [];
    }
    const data: unknown = await response.json();
    const parsed = geocodingResponseSchema.safeParse(data);
    if (!parsed.success) {
      return [];
    }
    return (parsed.data.results ?? []).map((result) => ({
      label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

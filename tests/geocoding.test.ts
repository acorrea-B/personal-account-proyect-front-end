import { describe, expect, it, vi } from 'vitest';

import { searchCities } from '../lib/api/geocoding';

describe('searchCities', () => {
  it('returns empty suggestions before the minimum query length, without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchCities('B')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins name, region and country into the exact place label', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'Bogotá',
              admin1: 'Bogotá D.C.',
              country: 'Colombia',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const suggestions = await searchCities('bog');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('name=bog'),
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(suggestions).toEqual([{ label: 'Bogotá, Bogotá D.C., Colombia' }]);
  });

  it('collapses identical place labels into one suggestion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { name: 'Ja', admin1: 'Southern Darfur', country: 'Sudan' },
            { name: 'Ja', admin1: 'Southern Darfur', country: 'Sudan' },
            { name: 'Jāmunda', admin1: 'Odisha', country: 'India' },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const suggestions = await searchCities('ja');

    expect(suggestions).toEqual([
      { label: 'Ja, Southern Darfur, Sudan' },
      { label: 'Jāmunda, Odisha, India' },
    ]);
  });

  it('answers empty when the api carries no results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchCities('nowhere')).toEqual([]);
  });

  it('degrades to empty on http or network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    expect(await searchCities('bog')).toEqual([]);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await searchCities('bog')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { formatWhen } from '../components/cv-timeline';

describe('formatWhen', () => {
  it('formats an archived_at as a short en-US stamp', () => {
    expect(formatWhen('2026-10-26T09:03:00.000Z')).toMatch(/Oct 26, 9:03/);
  });

  it('formats the stamp in the es tree language', () => {
    const stamp = formatWhen('2026-10-26T09:03:00.000Z', 'es');
    expect(stamp).toMatch(/26/);
    expect(stamp.toLowerCase()).toContain('oct');
    expect(stamp).not.toMatch(/Oct 26/);
  });

  it('keeps the minutes visible so two saves on a day read apart', () => {
    expect(formatWhen('2026-10-26T09:04:00.000Z')).not.toBe(formatWhen('2026-10-26T09:03:00.000Z'));
  });
});

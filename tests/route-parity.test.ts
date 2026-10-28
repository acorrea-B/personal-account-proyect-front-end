import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// The two locale trees are one implementation per page plus route stubs:
// app/** owns the english tree and app/es/** mirrors every route with a
// one-line wrapper. The stale-duplication danger is a MISSED stub - the
// es route would answer 404 with no build or test failing (it happened:
// /es/app/profile shipped without a page). This suite walks both trees
// and fails when the route sets drift apart in either direction, so the
// parity is validated by the build gate, not by memory.

const ROOT = join(process.cwd(), 'app');

// Collects the route paths relative to app/ for one tree.
function collectPages(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .map((entry) => relative(ROOT, join(dir, entry)).split(sep).join('/'))
    .filter((path) => path.endsWith('page.tsx') || path.endsWith('page.ts'))
    .sort();
}

describe('route parity between the locale trees', () => {
  it('mirrors every english route with an es stub and nothing else', () => {
    const all = collectPages(ROOT);
    const en = all.filter((path) => !path.startsWith('es/'));
    const es = all
      .filter((path) => path.startsWith('es/'))
      .map((path) => path.slice('es/'.length))
      .sort();

    expect(en.length).toBeGreaterThan(0);
    expect(es.length).toBe(en.length);
    expect(es).toEqual(en);
  });

  it('no stray files ride the es tree', () => {
    // Any file inside app/es that is not a route stub would signal the old
    // duplication pattern creeping back (the trees may only own stubs -
    // every real implementation lives in the shared views).
    const strie = readdirSync(join(ROOT, 'es'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).split(sep).join('/'))
      .filter((path) => !path.endsWith('/page.tsx') && path !== 'es/page.tsx');
    expect(strie).toEqual([]);
  });
});

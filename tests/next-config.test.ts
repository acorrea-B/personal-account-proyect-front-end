import { afterAll, describe, expect, it, vi } from 'vitest';

// The next config resolves the dist dir at module load: the tests reset
// the module registry per case and import a fresh evaluation.
const ORIGINAL_ENV = process.env.NEXT_DIST_DIR;

afterAll(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.NEXT_DIST_DIR;
  } else {
    process.env.NEXT_DIST_DIR = ORIGINAL_ENV;
  }
});

describe('next config', () => {
  it('keeps the dev dist dir when no override is set', async () => {
    delete process.env.NEXT_DIST_DIR;
    vi.resetModules();
    const nextConfig = (await import('../next.config')).default;
    expect(nextConfig).not.toHaveProperty('distDir');
  });

  it('moves the build artifacts under NEXT_DIST_DIR', async () => {
    process.env.NEXT_DIST_DIR = '.next-prod';
    vi.resetModules();
    const nextConfig = (await import('../next.config')).default;
    // A production build into the default .next dir would replace the
    // dev server's chunk vocabulary mid-flight and 404 every live route;
    // the override isolates them.
    expect((nextConfig as { distDir?: string }).distDir).toBe('.next-prod');
  });

  it('keeps the static export contract beside the override', async () => {
    process.env.NEXT_DIST_DIR = '.next-prod';
    vi.resetModules();
    const nextConfig = (await import('../next.config')).default;
    expect(nextConfig.output).toBe('export');
    expect(nextConfig.trailingSlash).toBe(true);
  });
});

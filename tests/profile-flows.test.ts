import { describe, expect, it } from 'vitest';

import { fullNameProblem, profileWriteFlow } from '../lib/api/profile';
import type { Profile } from '../lib/schemas/profile';

// The two write flows share PUT /v1/profile but not their background
// rules: onboarding replaces the seeded placeholder, update keeps a live
// profile complete and can never reinstall the placeholder.
function profileWith(fullName: string): Profile {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'juan@example.com',
    full_name: fullName,
    created_at: '2026-10-27T00:00:00.000Z',
    updated_at: '2026-10-27T00:00:00.000Z',
  };
}

describe('profileWriteFlow', () => {
  it('routes the seeded placeholder to the onboarding flow', () => {
    expect(profileWriteFlow(profileWith('User'))).toBe('onboarding');
    expect(profileWriteFlow(profileWith('user'))).toBe('onboarding');
    expect(profileWriteFlow(profileWith('  '))).toBe('onboarding');
  });

  it('routes a completed profile to the update flow', () => {
    expect(profileWriteFlow(profileWith('Juan Pérez'))).toBe('update');
  });
});

describe('fullNameProblem per flow', () => {
  it('onboarding: a missing name blocks the save with the required message', () => {
    expect(fullNameProblem('', 'onboarding')).toMatch(/required/i);
    expect(fullNameProblem('   ', 'onboarding')).toMatch(/required/i);
    expect(fullNameProblem('Juan Pérez', 'onboarding')).toBeNull();
  });

  it('update: the name cannot be emptied', () => {
    expect(fullNameProblem('', 'update')).toMatch(/cannot/i);
    expect(fullNameProblem('   ', 'update')).toMatch(/cannot/i);
  });

  it('update: the placeholder can never be reinstalled', () => {
    expect(fullNameProblem('User', 'update')).toMatch(/placeholder/i);
    expect(fullNameProblem('  user  ', 'update')).toMatch(/placeholder/i);
  });

  it('update: a real name passes', () => {
    expect(fullNameProblem('Alejandro', 'update')).toBeNull();
  });
});

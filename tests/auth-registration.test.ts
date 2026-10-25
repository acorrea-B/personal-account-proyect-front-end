import { describe, expect, it } from 'vitest';
import { registerRequestSchema } from '../lib/schemas/auth';

describe('auth registration', () => {
  it('accepts a valid registration request with email and password', () => {
    const result = registerRequestSchema.safeParse({
      email: 'juan@example.com',
      password: 'contraseña1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: 'juan@example.com', password: 'contraseña1' });
    }
  });
});

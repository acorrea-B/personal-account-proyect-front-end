# API cassettes for tests

This project uses **record/replay cassettes only in automated tests**. Cassettes
must never contain plaintext secrets or PII committed to the repository.

## Environments

- **Local development**: store the key in `.env.local` as `CASSETTE_ENCRYPTION_KEY`.
- **CI/CD**: store the key as the GitHub Actions secret `CASSETTE_ENCRYPTION_KEY`.
- Never use `NEXT_PUBLIC_` for this value; it is not a client runtime concern.

## Security rules

1. Cassettes on disk are encrypted at rest (AES-256-GCM recommended) with a
   random IV and authentication tag.
2. The encryption key is supplied by the environment and never committed.
3. Redaction happens before encryption: auth headers, tokens, passwords, email
   values and user identifiers are scrubbed or normalized.
4. Plaintext cassettes are not allowed in version control. Keep any temporary
   plaintext captures under `tests/cassettes/*.plain.json` (gitignored).
5. CI must fail if a plaintext cassette is found or if decryption cannot run
   in replay mode.

## Storage convention

- Encrypted cassettes: `tests/cassettes/**/*.enc.json`.
- CI uses the secret `CASSETTE_ENCRYPTION_KEY` for the test step:

```yaml
- name: Tests (coverage)
  env:
    CASSETTE_ENCRYPTION_KEY: ${{ secrets.CASSETTE_ENCRYPTION_KEY }}
  run: npm run test:coverage
```

## Planned implementation (separate batch)

- Add a small encrypted recorder/replayer behind the existing HTTP client tests.
- Introduce it incrementally; auth behavior tests remain HTTP-mock based unless
  a story explicitly moves them to cassettes.

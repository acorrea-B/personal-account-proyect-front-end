# Professional Profile Front-end

**Next.js (App Router) web client for the professional profile API** — a private,
versioned workspace for a professional profile and CV. Created 100% with AI
assistance, following Spec-Driven Development and the operator's conventions in
[AI-agents-settings](https://github.com/acorrea-B/AI-agents-settings).

![CI](https://github.com/acorrea-B/personal-account-proyect-front-end/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/acorrea-B/personal-account-proyect-front-end/actions/workflows/deploy.yml/badge.svg)
![Release](https://img.shields.io/badge/release-v0.4.5-2563EB)
![Node](https://img.shields.io/badge/node-24-43853D)
![Tests](https://img.shields.io/badge/tests-157%20passing-4c9a2a)
![Audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-4c9a2a)
![Model](https://img.shields.io/badge/LLM-glm--5.3--flash%3Acloud-8A2BE2)
![i18n](https://img.shields.io/badge/i18n-dictionaries%20first%20%28en%2Fes%29-805493)

## Repository tags (GitHub topics)

`nextjs` · `react` · `typescript` · `zod` · `i18n` · `internationalization` ·
`static-site` · `static-export` · `scaleway` · `object-storage` · `tailwind-planned` ·
`accessibility` · `wcag-2-2-aa` · `seo` · `ai-generated` · `spec-driven-development`

> Paste the list above in _Settings → General → Topics_ so GitHub's search and
> topic pages (the engines) index the repository. The repo description lives in
> _Settings → General → Description_: `Private professional profile + CV workspace — Next.js static export, en/es dictionaries-first i18n, Scaleway hosting.`

## Stack

| Layer      | Choice                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), statically exported                                                                         |
| Language   | TypeScript strict                                                                                                    |
| State/API  | React 19 + Zod 4 schemas at every boundary (no server, no React Query)                                               |
| Styling/UI | Seline Analytics (Refero) via `docs/design-brief.md` and `design/references/selected-style.md` (Tailwind v4 planned) |
| i18n       | Dictionaries-first (`lib/i18n/en.json` + `es.json`), en/es key parity validated in CI, route trees per locale        |
| Delivery   | Static export (`output: 'export'`, `trailingSlash`) → Scaleway Object Storage website hosting                        |
| CI/CD      | GitHub Actions (ci + deploy + PR checks), actions at their node-24 majors, runtime Node 24                           |

## The i18n model (a standing rule since the first commit)

- Every user-facing string lives in `lib/i18n/en.json` / `lib/i18n/es.json`
  (~190 keys), both parsed through one shared zod schema at import time — a
  missing or drifted key fails the build.
- A route-parity test walks `app/` and `app/es/` and fails when the locales'
  route sets diverge; the `app/es/**` pages are one-line wrappers owning the
  locale while every implementation lives exactly once in `components/*-view.tsx`.
- Internal links, form handoffs and redirects hang from the tree's base prefix;
  the language switch performs a full document navigation (the static export
  keeps one html per locale); `document.documentElement.lang` follows the tree.
- Backend problem details keep the contract's english voice; the tree voice
  composes around them via the dictionary.
- The full lesson: `docs/lessons/i18n-first-dictionaries.md`.

## Backend contract

Consumes `personal-account-proyect` (OpenAPI 3.1 in that repo's `docs/openapi.yaml`).
Public env vars (`NEXT_PUBLIC_*`) only carry the API base URL and publishable
Supabase key. All API responses are validated with Zod before rendering; errors
surface as RFC 7807 problem details without internal diagnostics.

## Delivery target

The application ships as a static Next.js export to Scaleway Object Storage's
website hosting (`infra/scaleway-static-site` owns the bucket and the website
setup). Pushing a tag `v*` reconciles the infrastructure and publishes the
static export of that tag. See `docs/design-brief.md` sections 8, 13 and 14.

## Development

```bash
npm run dev              # local dev on :3000
npm run build            # the static export (out/); the ci/deploy shape
npm run build:isolated   # production build into .next-prod (never races a live dev server)
npm run lint             # eslint, zero warnings gate
npm run typecheck        # tsc --noEmit
npm run test             # vitest (jsdom component tests + lib suites)
npm run test:coverage    # v8 coverage, text + lcov
```

Without Node on the host (WSL with only a Windows Node), run everything in the
dev container: `docker compose -f compose.dev.yaml up` serves live reload on
`127.0.0.1:3001` from `.next-docker/`, and the gates run with
`docker compose -f compose.dev.yaml run --rm --no-deps web npm test` (same for
`typecheck`, `lint`, `format:check`). The container keeps its own
`node_modules` in a named volume that outlives the image, so after a
dependency change drop the volume with the rebuild:
`docker compose -f compose.dev.yaml down -v && docker compose -f compose.dev.yaml up --build`
(a plain `build` would keep serving the old packages from the volume).

Conventions: test-first functional code; features never exceed six files
(stacked windows); Conventional Commits in English with a descriptive body;
docs in the language the repo declares. The full contract lives in `AGENTS.md`
(intentionally gitignored — operator-local) and the lessons in
`docs/lessons/`.

## Security posture

- Zod validation at every boundary; credentials never reach the client code or
  bundle; secrets only in `.env*.local` (gitignored), documented in `.env.example`.
- Session tokens ride `sessionStorage` (single-flight refresh with reuse-kill
  protection); the access handoff travels through sessionStorage, never the URL.
- `npm audit`: zero vulnerabilities across production and tooling (the october
  2026 wave: postcss patched via override, vitest 5 for the tinypool/mocker/
  esbuild chains). A production dependency bump stays pinned to its review
  window with the gates green.
- Production smoke tests run on the website endpoint after every tag deploy.

## Model traceability

Development model (current): **`glm-5.3-flash:cloud`** (Ollama, via the pi
coding agent). Earlier batches recorded `beam:cloud` (Ollama) in
`docs/task-metrics.md` — update this line whenever the model changes.

## Task metrics

Per-task token count, execution time, and successful iterations are recorded in
`docs/task-metrics.md` (uncaptured values are stated as limitations, never
fabricated).

## Environment

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

Next.js env file precedence: `.env.local` overrides `.env.production`. For a
production build use `NEXT_PUBLIC_API_BASE_URL=https://... npm run build`, or
remove `.env.local` first. The deploy workflow embeds the backend URL at build
time and verifies it before publishing.

## Operations

- `infra/scaleway-static-site` owns the Scaleway bucket and static website
  configuration (terraform).
- Pushing a tag `v*` reconciles that infrastructure and then publishes the
  static site (the deploy workflow builds the artifact of the tagged tree).
- `SCALEWAY_STORAGE_BUCKET` must contain the bucket created by Terraform.
- The static site serves from the bucket's website endpoint; the raw S3 API
  endpoint intentionally answers 403 on the root (documented in the seo
  baseline, `docs/task-metrics.md`).

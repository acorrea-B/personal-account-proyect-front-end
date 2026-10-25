# Professional Profile Front-end

Next.js (App Router) web client for the professional profile API defined in
`personal-account-proyect`. Created 100% with AI assistance, following Spec-Driven
Development and the conventions in `AI-agents-settings`.

## Stack

| Layer      | Choice                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js (App Router)                                                                                                 |
| Language   | TypeScript (strict)                                                                                                  |
| Styling/UI | Seline Analytics (Refero) via `docs/design-brief.md` and `design/references/selected-style.md` (Tailwind v4 planned) |
| API        | `personal-account-proyect` REST API                                                                                  |
| Delivery   | Static export (`output: 'export'`, trailingSlash) for Scaleway Object Storage                                        |
| Locale     | English/Spanish client-side i18n (static-export compatible)                                                          |
| Data layer | React Query + Zod, client-side API access                                                                            |

## Design reference

Selected visual reference: Seline Analytics.
See `design/references/selected-style.md` and `docs/design-brief.md`.

## Delivery target

The application is shipped as a static Next.js export to Scaleway Object Storage
website hosting. See `docs/design-brief.md` sections 8, 13 and 14.

## Model traceability

Development model: `beam:cloud` (Ollama, via pi coding agent) — provider `ollama`,
base URL `http://127.0.0.1:11434`. Update this line whenever the model changes.

## Task metrics

Per-task token count, execution time, and successful iterations are recorded in
`docs/task-metrics.md` once work begins. No metrics are fabricated.

## Environment

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

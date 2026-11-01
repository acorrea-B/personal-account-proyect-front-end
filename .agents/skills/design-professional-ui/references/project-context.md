# Contexto del proyecto

## Fuentes y alcance

- Repo: https://github.com/acorrea-B/personal-account-proyect-front-end
- Referencia: https://styles.refero.design/style/7967c6d9-e50c-42b5-b4d1-74003ba41781
- Base inspeccionada: 2026-11-01, revisión `a5174f8b4e5100ee047a8afa07eced4747cc48ac`. Volver a comprobar al trabajar; esta nota no es estado vivo.
- Producto: espacio privado para perfil profesional, CV versionado, IA, evolución y diario. No asumir un catálogo público de candidatos ni añadir contratación.

## Conservar y adaptar

Conservar claridad editorial, canvas cálido, contraste tinta/papel, bordes discretos, espacio y prioridad de acción. La referencia original usa un solo acento cian. Las familias semánticas propuestas aquí son una adaptación al producto y al encargo del propietario, no colores extraídos de Refero.

La petición actual solicita composición, mejores cards y juego cromático. Al implementar esa dirección, actualizar la regla antigua que impida la extensión concreta. No pedir otra aprobación solo porque un brief anterior diga «un solo acento». Mantener contratos y demás instrucciones vigentes.

## Leer primero

| Área | Archivos observados | Atención |
| --- | --- | --- |
| Intención | `docs/design-brief.md` | Contrastar brief histórico con código y encargo |
| Referencia | `design/references/selected-style.md`, `selected-style.tokens.json` | Versión extendida; conservar origen |
| Lecciones | `docs/lessons/view-generation-memory.md`, `visual-polish-iteration-spec.md` | Composición, contraste y prueba en navegador |
| Tema | `app/globals.css` | Tailwind v4 y extensiones existentes |
| Primitivas | `components/ui.tsx`, `icons.tsx` | Cards, botones, inputs, SVG |
| Inicio | `components/dashboard-view.tsx`, `home-highlights.tsx`, `profile-metrics.tsx`, `recent-activity.tsx` | Orientación, siguiente paso y magnitudes |
| Perfil | `components/profile-view.tsx`, `skill-suggestions-card.tsx` | Edición y aceptación explícita |
| CV | `components/cv-editor-view.tsx`, `cv-history-panel.tsx`, `cv-timeline.tsx`, `ai-suggestions-card.tsx` | Edición, versiones y evidencia |
| Carrera | `components/evolution-card.tsx`, `evolution-view.tsx`, `journal-view.tsx` | Meta, criterio, horizonte y registro |
| Datos | `lib/schemas/profile.ts`, `harness.ts`, `evolution.ts`, `lib/api/` | Contratos y significado |
| Idiomas | `lib/i18n.ts`, `lib/i18n/en.json`, `es.json` | Diccionarios y paridad |

## Restricciones técnicas

- Next.js 15 App Router, React 19, TypeScript, Zod y salida estática. Releer `package.json` y `next.config.ts`.
- Tailwind v4 ya implementado en la revisión inspeccionada; el README aún lo menciona como planeado. Preferir archivos actuales y `docs/tailwind-migration.md`.
- Capas theme y utilities sin preflight. No activar un reset como efecto lateral.
- Escalas predeterminadas borradas. `p-16` = 16px y `gap-24` = 24px; `bg-emerald-50` no existe sin declararlo.
- Breakpoints observados: `sm` 641px, `md` 861px. No asumir valores estándar.
- Inter e Inter Tight locales; `font-roobert` resuelve al sustituto cargado. No exigir una descarga de Roobert.
- Ya existen cian de acción con texto tinta, `--color-cyan-text`, `--color-cyan-text-strong`, teal y `--color-alert`. Consolidar antes de duplicar.
- Rutas en/es. Leer implementación antes de deducir estrategia del brief antiguo.

## Integridad de datos

- `profileMetricsSchema` distingue tasas nulas de cero. Estado del CV y sugerencias no equivalen a empleabilidad ni valor humano.
- Estados IA: `AllSupported`, `Mixed`, `Blocked`, `AllInferred`. Traducir etiquetas sin cambiar enums; preservar diferencias y motivos.
- `overClaimedLimit = 0.2` es un umbral existente del componente inspeccionado, no una recomendación de este skill. No alterarlo por preferencia cromática.
- No convertir seniority o confianza del modelo en prestigio absoluto. Mantener explicación y revisión.
- Usar fixtures sintéticos en previews compartidas; no exponer email u otros datos privados.

## Validación proporcional

Para cambios de componentes o comportamiento, usar comandos pertinentes de `package.json`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y formato de archivos tocados; respetar CI. Para documentación, validar estructura, enlaces y consistencia. No afirmar que se verificó UI ni ejecutar toda la aplicación sin necesidad.

# Color por función

## Decidir antes de añadir

Asignar a cada tono un rol, una pareja texto/fondo y una etiqueta accesible. Si no se puede explicar qué ayuda a reconocer, resolver primero espacio, escala y agrupación. Combinar superficies blancas, neutras, suaves e invertidas sin igualar el peso de todo. No imponer porcentajes cromáticos como norma científica.

## Base existente

| Uso        | Token                      | Valor     | Criterio                                  |
| ---------- | -------------------------- | --------- | ----------------------------------------- |
| Canvas     | `--color-stone-canvas`     | `#fafaf9` | Fondo cálido                              |
| Card       | `--color-pure-white`       | `#ffffff` | Lectura y edición                         |
| Texto      | `--color-ink-black`        | `#0c0a09` | Jerarquía principal                       |
| Secundario | `--color-warm-gray`        | `#78716c` | Medir sobre el fondo real                 |
| Invertido  | `--color-soot`             | `#1c1917` | Resumen puntual con texto claro explícito |
| Hairline   | `--color-stone-border`     | `#e8e6e5` | Decorativo; no único indicador funcional  |
| Acción     | `--color-cyan-signal`      | `#3ba6f1` | CTA con texto tinta                       |
| Enlace     | `--color-cyan-text-strong` | `#0d68b8` | Sobre claro; subrayar cuando corresponda  |
| Tinte      | `--color-sky-wash-soft`    | `#e3f1fb` | Orientación o siguiente acción            |
| Favorable  | `--color-teal-text`        | `#0f766e` | Evidencia real y etiqueta explícita       |
| Problema   | `--color-alert`            | `#b91c1c` | Error o atención requerida                |

No usar `--color-ash-gray` para texto necesario sobre blanco sin medirlo. Distinguir un borde decorativo tenue de un borde necesario para identificar un control.

## Extensión candidata

Usar solo los roles necesarios. Estos fondos son propuestas del skill, no tokens ya presentes ni colores de Refero. Reutilizar equivalentes actuales antes de añadirlos.

| Familia | Texto     | Fondo suave | Significado                                           |
| ------- | --------- | ----------- | ----------------------------------------------------- |
| Teal    | `#0f766e` | `#f0fdfa`   | Evidencia respaldada o resultado favorable demostrado |
| Ámbar   | `#92400e` | `#fffbeb`   | Pendiente de revisión o respaldo parcial              |
| Rojo    | `#b91c1c` | `#fef2f2`   | Fallo o bloqueo que exige atención                    |
| Neutra  | `#57534e` | `#f5f5f4`   | Sin evaluar, información o inferencia                 |

Para `Blocked` por falta de evidencia, elegir ámbar o rojo según la consecuencia, sin cambiar la etiqueta ni mostrar la propuesta bloqueada como consejo aplicable. Para inferencias, usar «Inferido» neutral, sin apariencia de verificación.

Si una categoría necesita color, definir una familia independiente con nombre de dominio y mantenerla entre rutas. No usar teal para «CV» y a la vez «Aprobado». Preferir etiquetas, cabeceras o marcadores antes que llenar cada contenedor. Un CTA cian y una etiqueta teal pueden coexistir: acción y estado cumplen funciones distintas.

## Contraste y estados

- Medir texto normal a 4.5:1 como mínimo. Aplicar 3:1 a texto grande solo cuando cumpla su definición: aproximadamente 24 CSS px regular o 18.67 CSS px en negrita. No redondear un valor insuficiente para aprobarlo.
- Evaluar a 3:1 las partes necesarias para identificar controles y gráficos frente a colores adyacentes, según WCAG 1.4.11; no exigirlo a cada hairline decorativa.
- No copiar blanco sobre `#3ba6f1` para texto normal. Usar tinta o un fondo más oscuro y volver a medir.
- Revisar foco: cian claro puede ser insuficiente sobre blanco. Usar un tono oscuro o dos capas con contraste adecuado y comprobar que no quede oculto.
- Declarar texto, enlaces, iconos y hover de superficies oscuras. No heredar gris pensado para blanco.
- Medir estados selected, hover, disabled y error, además del inicial. Considerar transparencias y fondos reales; el script solo admite opacos.

Desde el directorio del skill:

```bash
python3 scripts/check_contrast.py '#0c0a09' '#3ba6f1'
python3 scripts/check_contrast.py '#0f766e' '#f0fdfa'
python3 scripts/check_contrast.py '#ffffff' '#3ba6f1'
```

El tercer ejemplo debe fallar. Medir tokens no verifica tamaño, fuentes, foco, navegación ni toda la página.

Fuentes primarias: [texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [uso del color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

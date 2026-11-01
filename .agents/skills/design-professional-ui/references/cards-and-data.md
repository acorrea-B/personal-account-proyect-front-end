# Cards y representación de información

## Elegir por pregunta

| Pregunta | Representación | Contenido y salida |
| --- | --- | --- |
| ¿Cómo está mi perfil y qué sigo? | Identidad + siguiente paso | Datos existentes, estado, acción contextual |
| ¿Qué mide este resultado? | Indicador compacto | Etiqueta, valor/unidad, revisión y significado |
| ¿Qué respalda esta sugerencia? | Evidencia | Verificación, propuesta, motivo, respaldo disponible y decisión |
| ¿Qué cambió? | Comparación o diff | Versión/fecha, cambios y contenido completo |
| ¿Qué ocurrió y cuándo? | Lista temporal | Evento, fecha y detalle a demanda |
| ¿Qué necesito editar? | Sección de formulario | Campos relacionados, validación y guardado |
| ¿Cómo avanzo a mi meta? | Resumen de evolución | Rol, criterio, horizonte y siguiente acción reales |
| ¿Qué entradas comparo? | Tabla o lista alineada | Atributos iguales en el mismo orden |

## Anatomía adaptable

Ordenar contexto/estado → contenido protagonista → evidencia/fecha/consecuencia → acción. Omitir piezas redundantes; no imponer cuatro filas a todo. Mantener juntas las piezas que se explican entre sí y alinear acciones de elementos comparables sin forzar alturas enormes.

## Variantes por función

- **Identidad:** destacar con tipografía y datos. No inventar avatar, cargo, disponibilidad o completitud.
- **Siguiente paso:** dar más espacio y tinte de marca; explicar beneficio y usar CTA principal. Cambiar según estado real; no repetir siempre «Completa tu perfil».
- **Indicador:** base neutral y número protagonista. Diferenciar magnitud, cambio y juicio de calidad. No llenar de rojo por una variación pequeña.
- **Evidencia:** etiqueta semántica y estructura propuesta/motivo/respaldo. Mostrar texto antes de aplicar. Si la API no incluye fuente, no inventar enlace.
- **Actividad:** lista con separaciones discretas; no elevar cada registro.
- **Edición:** blanco estable, color para foco, validación y feedback; no colorear campos para variar.

Usar una card invertida solo si un resumen merece énfasis. Mantener bordes/sombras discretos; elevar todos los bloques elimina jerarquía.

## Composición posible del inicio

1. Cabecera compacta de orientación.
2. Siguiente paso prioritario con más espacio; resumen de evolución al lado si existe meta.
3. Indicadores comparables con acceso a explicación.
4. Actividad reciente en lista, sin competir por prominencia.

Conservar lectura al apilar. Si los indicadores son necesarios para decidir el siguiente paso, situarlos antes. Este ejemplo no es un wireframe obligatorio para toda vista.

## Ejemplos de criterio

**«Haz más interesantes estas cuatro cards».** Comprobar si son indicadores comparables o tareas distintas. Mantener uniformidad en el primer caso; variar jerarquía y anatomía en el segundo. No asignar cuatro colores aleatorios.

**«La card de IA es otro bloque de texto».** Separar propuesta, motivo y verificación. Para `Mixed`, usar «Respaldo parcial» con señal de revisión y explicación disponible. Permitir revisar antes de aceptar; no marcar «Validado» ni aceptar automáticamente.

**«Mostrar progreso del CV».** Comprobar medición y revisión anterior comparables. Mostrar valor y cambio solo si existen; de lo contrario, estado actual o «Aún sin evaluación». No fabricar un 75% ni deducir tendencia de campos completados.

## Evitar trampas

- No usar donas, radar o barras decorativas cuando un número/lista responde mejor.
- No tratar una subida como favorable para toda tasa; `over_claimed_rate` puede requerir atención al aumentar.
- Distinguir porcentaje de puntos porcentuales; identificar base y periodo.
- No duplicar estado en badge, título, banner y fondo sin aportar información.
- No recortar contenido decisivo sin acceso al texto completo. Probar español y nombres largos.
- No dar elevación hover a cards informativas ni ocultar acciones esenciales hasta hover.

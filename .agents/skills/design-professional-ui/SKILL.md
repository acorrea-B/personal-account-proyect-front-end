---
name: design-professional-ui
description: Diseñar, implementar y revisar interfaces de perfiles profesionales, CV y evolución de carrera con criterio UI/UX senior. Usar al crear o mejorar pantallas, cards, dashboards privados, formularios, métricas o paletas semánticas que se perciban planas, repetitivas o limitadas a azul y blanco. Adaptar referencias por composición y comportamiento, especialmente Seline Analytics en acorrea-B/personal-account-proyect-front-end, sin copiar únicamente sus colores.
---

# Diseñar interfaces profesionales con criterio

Convertir datos y tareas en una composición que permita entender el estado, reconocer lo importante y actuar. Conservar la calma editorial de la referencia; aportar variedad mediante jerarquía, escala, densidad, superficies y color con significado.

## 1. Reconstruir el contexto

1. Leer instrucciones, vista solicitada, componentes compartidos, tokens, esquemas y diccionarios. Verificar el estado actual; no tratar este skill como inventario actualizado del código.
2. Para el proyecto de Alejandro, leer [contexto del proyecto](references/project-context.md). Consultar Refero extendido o su copia local. Distinguir lo observado de una adaptación propia.
3. Identificar usuario y tarea. Diferenciar landing pública, edición privada y lectura de resultados de IA. No convertir todas en un dashboard.
4. Inspeccionar la pantalla existente si hay navegador. Si solo hay código, declarar esa limitación; no afirmar validación visual.
5. Dar un diagnóstico breve: problema observable → dificultad para la persona → cambio. Continuar con la implementación si forma parte del encargo, sin pedir aprobación por decisiones rutinarias.

## 2. Definir un contrato visual pequeño

Antes de implementar, completar esta ficha en la respuesta o especificación:

| Decisión | Contenido |
| --- | --- |
| Tarea | Qué necesita conseguir la persona |
| Lectura | Qué entender primero, después y al abrir detalle |
| Foco | Qué bloque merece más espacio y por qué |
| Acción | Acción principal, alternativa y resultado |
| Datos | Campos disponibles, procedencia y ausencias |
| Composición | Orden, relaciones y adaptación móvil |
| Color | Rol de cada tono: categoría, acción o estado |
| Estados | Carga, vacío, error, éxito y datos parciales aplicables |
| Prueba | Cómo comprobar tarea, legibilidad y comportamiento |

Mantener la ficha proporcionada al cambio: una frase para una etiqueta; composición completa para reorganizar una vista.

## 3. Diseñar el flujo de lectura

- Elegir un foco por tarea. Usar tamaño y posición antes de saturación; evitar rectángulos de igual importancia por defecto.
- Organizar orientación → contenido principal → evidencia/contexto → siguiente acción. Adaptar el orden a edición o comparación.
- Usar columnas 2:1 cuando exista contenido principal y apoyo; columnas iguales para elementos comparables. No imponer un bento que rompa lectura o cree huecos.
- Mantener en móvil el orden lógico del DOM y los pares dato/etiqueta y acción/resultado. Apilar por prioridad.
- Usar separaciones pequeñas dentro de un grupo, medianas entre grupos y mayores entre secciones. No trasladar mecánicamente 96px de una landing a un formulario.
- Alternar bloques abiertos, listas y cards cuando su relación lo justifique. No envolver cada campo en otra card.
- Resolver jerarquía en escala de grises y añadir semántica cromática. No usar esa revisión para eliminar color útil solicitado.

## 4. Representar información con intención

Leer [cards y datos](references/cards-and-data.md) para métricas, IA, CV, historial o perfil.

- Dar a cada card una pregunta, un contenido protagonista y una salida útil. Evitar título + párrafo + botón repetidos sin razón.
- Elegir indicador para magnitud real; lista para elementos; timeline para secuencia; diff para antes/después; formulario para edición; tabla para comparar atributos homogéneos.
- Diferenciar anatomías de identidad, siguiente paso, indicador, evidencia, actividad y edición. Mantener el mismo patrón para la misma función entre rutas.
- Mostrar números con etiqueta, unidad, periodo/revisión y explicación disponible. No inventar puntuaciones, objetivos, tendencias ni porcentajes para llenar espacio.
- Distinguir cero, sin datos, no evaluado, pendiente y fallo. No trazar una tendencia con una sola observación.
- Mantener procedencia y verificación visibles en sugerencias de IA. Permitir revisión antes de aplicar y conservar la decisión de la persona.
- Reducir contenido inicial si es extenso, con acceso claro al detalle. No ocultar advertencias ni acciones necesarias en tooltips.

## 5. Usar color como sistema

Leer [sistema de color](references/color-system.md) antes de añadir tonos o cambiar superficies.

1. Separar base neutral, marca/acción, categorías y estados. No usar verde para una categoría si significa aprobación en la misma vista.
2. Conservar canvas cálido, texto tinta y superficies claras. Aprovechar neutros, tintes suaves y una superficie invertida puntual para crear profundidad.
3. Reutilizar tokens actuales. Añadir una familia con un rol estable y documentado: considerar teal para evidencia favorable, ámbar para revisión y rojo para atención, solo donde haga falta.
4. Para categorías, preferir etiquetas y agrupación antes que un tono por card. Mantener estable cualquier color de categoría y separarlo de los estados.
5. Usar fondos tenues con texto oscuro en áreas grandes. Reservar saturación para acciones, indicadores pequeños y señales prioritarias. No colorear todas las cards para cumplir una cuota.
6. Separar estado de prioridad de acción: una etiqueta teal puede convivir con una acción de marca; no necesita un botón verde.
7. Revisar texto/fondo, bordes funcionales y foco. Acompañar estados con texto o iconos comprensibles; nunca depender solo del tono.

Tratar las prohibiciones antiguas de acentos como decisiones del brief original. En el proyecto señalado, la petición de ampliar el criterio autoriza una extensión semántica razonada. Documentar esa adaptación y actualizar instrucciones contradictorias al integrar un cambio. Conservar intacta la copia de la referencia original.

## 6. Cuidar experiencia y controles

- Reutilizar fuentes y escala: Inter Tight para titulares e Inter para UI en este proyecto. Destacar con tamaño y espacio; reservar peso alto para énfasis local.
- No usar captions de 10px para datos decisivos. Conservar tamaños legibles actuales y tolerar expansión del español.
- Usar verbos concretos: «Revisar sugerencias», «Guardar cambios», «Comparar versión». Explicar el resultado cuando pueda haber duda.
- Dar mayor prominencia a la acción principal del área; mantener secundarias más quietas y descubribles. No imponer un solo botón por viewport como ley universal.
- Agrupar campos por significado, con etiquetas visibles, errores asociados y preservación del texto al fallar. Separar lectura y edición si aporta claridad.
- Mostrar cambios pendientes, guardado, petición en curso y recuperación según el flujo real. Evitar dobles envíos y confirmaciones extra para cambios rutinarios.
- Distinguir cards informativas e interactivas. Usar enlaces para navegar y botones para acciones; no anidar controles dentro de enlaces ni hacer clicable una card con múltiples acciones.
- Mantener hover, focus-visible, active, selected y disabled. Dar nombre a iconos accionables y ocultar los decorativos de lectores de pantalla.
- Respetar movimiento reducido y mantener contenido visible sin animación. Usar movimiento para explicar cambios o feedback, sin retrasar acceso.

## 7. Implementar con el sistema existente

- Centralizar variantes necesarias de card, superficie y estado; evitar abstracciones con docenas de props antes de necesitarlas.
- Declarar nuevos colores en el tema de `app/globals.css`. Recordar que `p-16` significa 16px y la paleta Tailwind estándar está desactivada; leer [contexto](references/project-context.md).
- Usar mapas explícitos de variantes con clases completas detectables por Tailwind. No concatenar clases de color desde datos de API.
- Mantener Zod, contratos, rutas, sesión y diccionarios en/es. No modificar evaluación para mejorar apariencia.
- Diseñar ausencias honestas. Usar fixtures solo en demostraciones identificadas, sin enviarlos al perfil real.
- Limitarse al encargo. Un pedido de skill o auditoría no autoriza implementar un rediseño, añadir dependencias ni publicar una web.

## 8. Revisar con evidencia

Aplicar [lista de revisión](references/review-checklist.md). Para cambios UI, observar escritorio/móvil, estados e idiomas aplicables. Comprobar teclado, contraste, foco y textos largos.

Usar `scripts/check_contrast.py` para parejas hexadecimales opacas. No confundir el cálculo con una auditoría completa de accesibilidad.

Corregir problemas concretos observados. No declarar éxito visual por compilar o pasar tests. Si no se pudo renderizar, distinguir verificaciones hechas de las pendientes.

Al entregar, explicar cambio, decisión que facilita y verificación real, con limitaciones materiales. Cuando el encargo incluya implementación, completar los cambios autorizados después del diagnóstico.

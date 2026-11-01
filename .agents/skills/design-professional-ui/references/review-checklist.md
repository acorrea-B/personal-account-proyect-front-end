# Revisión con evidencia

## Antes de implementar

- [ ] Identificar tarea, foco, siguiente acción y datos.
- [ ] Especificar lectura, anatomía de cards y móvil.
- [ ] Asignar roles cromáticos sin mezclar categoría, estado y acción.
- [ ] Enumerar estados y copy en idiomas del proyecto.
- [ ] Para reorganizaciones amplias, comparar dos composiciones breves y elegir por tarea; no generar variantes por rutina.

## Juicio del resultado

| Dimensión | Evidencia de calidad | Señal para corregir |
| --- | --- | --- |
| Jerarquía | Tarea y acción reconocibles | Todo reclama igual atención |
| Cards | Cada bloque responde una pregunta | Plantilla repetida sin razón |
| Color | Roles estables, contrastados y etiquetados | Todo azul o tonos arbitrarios |
| Densidad | Agrupación y espacio proporcionados | Vacíos decorativos o compresión |
| Datos | Unidad, procedencia y ausencia claras | Cero para nulos o cifras de relleno |
| Interacción | Acciones, feedback y recuperación claros | Controles ocultos y errores sin salida |
| Adaptación | Lectura coherente móvil/escritorio | Scroll lateral u orden ajeno al DOM |

Usar como juicio de diseño, no como un score numérico supuestamente objetivo. Corregir lo observado antes de adornar.

## Navegador para cambios UI

- [ ] Revisar móvil/escritorio; considerar 375, 768 y 1280 CSS px en este repo, y el ancho de cualquier fallo.
- [ ] Revisar 320 CSS px y zoom/reflujo si hay riesgo; evitar scroll lateral en lectura normal.
- [ ] Probar en/es, nombres largos, títulos multilínea y conjuntos vacíos/grandes.
- [ ] Observar estados aplicables de carga, éxito, vacío, fallo y datos parciales; evitar saltos innecesarios.
- [ ] Recorrer Tab/Shift+Tab y teclas correspondientes a cada control. Ver foco, orden y retorno al cerrar diálogos.
- [ ] Comprobar etiquetas, errores asociados y anuncios de feedback sin duplicación molesta.
- [ ] Medir parejas reales y estados; no depender solo del color.
- [ ] Mantener 44px de área táctil como objetivo del producto; distinguir del mínimo AA de 24px con excepciones/separación en WCAG 2.5.8.
- [ ] Ver contenido con movimiento reducido y acciones sin animaciones bloqueantes.
- [ ] Usar datos sintéticos en capturas compartidas.

## Entrega

Indicar cambios, propósito y verificaciones realmente realizadas. Acompañar implementaciones visuales con capturas o prueba disponible. Si faltó navegador, decir «verificado en código; pendiente de revisión visual».

Fuente de tamaño de objetivos: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

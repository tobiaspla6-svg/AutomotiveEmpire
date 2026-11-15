> CHECKPOINT HISTÓRICO: para las 12 imágenes generadas y el montaje actual consultar `PRODUCTION_HANDOFF.md`.

# SUV 1990 — entrega de originales y preparación

## Estado real

La referencia maestra elegida es `production-assets/suv-1990-v1/sources/proposal-01.jpg`. Se conservaron los cuatro archivos enviados por el usuario sin modificación. Esta entrega es un checkpoint de producción, no el prototipo modular terminado.

Los archivos 1–3 son JPEG RGB de 2752 × 1536; el archivo 4 es PNG RGB de 1376 × 768. Ninguno contiene transparencia. No hay carrocería recortada, máscara de pintura, variantes aisladas ni composición modular aprobada en este paquete.

## Archivos existentes

| Ruta relativa a esta carpeta | Contenido | Estado |
| --- | --- | --- |
| `sources/proposal-01.jpg` | Carrocería seleccionada; materiales diferenciados, ensanches negros | Referencia elegida |
| `sources/proposal-02.jpg` | Alternativa de silueta clara y pintura más plana | Referencia |
| `sources/proposal-03.jpg` | Alternativa con barras y manijas cromadas | Referencia |
| `sources/proposal-04.png` | Cuarta imagen recibida por portapapeles | Referencia |
| `SELECCION.md` | Comparación visual y razones de selección | Documentación |
| `review-metadata.json` | Resoluciones, formatos, procedencia y SHA-256 | Verificado contra archivos |
| `qa/anchors.provisional.json` | Centros/radios estimados, cajas de búsqueda y transformación propuesta | Diagnóstico provisional |
| `qa/source-coordinate-review.png` | Original con coordenadas y círculos de diagnóstico | Diagnóstico, no imagen generada ni prueba de montaje |
| `qa/verification.json` | Comprobación de dimensiones, hashes y ausencia de alfa | Verificación de fuentes |
| `generation-log.json` | Fallos de captura de Windows; ninguna solicitud de generación enviada | Registro |
| `prepare_checkpoint.py` | Reproduce mediciones y gráfico sin modificar los originales | Herramienta de análisis |

## Instrucciones para Claude Code

1. Conservar estos originales. No copiar el JPEG con su fondo blanco al juego como si fuese una capa transparente.
2. Crear una familia independiente `suv90-green` cuando existan piezas verificadas. No reutilizar los anclajes de GT01 ni alterar economía, demanda, normativas, guardados o simulador para incorporar arte.
3. Preparar una única carrocería con alfa real y sombra separada; la eliminación del fondo sigue pendiente. Comprobar bordes en fondos claro, oscuro y saturado. No perforar cristales ni pintura clara.
4. La producción apunta a 1600 × 700. `qa/anchors.provisional.json` propone una sola transformación uniforme y registra la fuente. Aún no se aplicó ni se exportó una maestra de producción. Ajustarla solo al preparar esa maestra y congelarla después para todas las capas. No estirar el automóvil.
5. Los centros de neumáticos proceden de detección circular con tolerancia aproximada de 5 px en la fuente. Las cajas de ópticas/paragolpes son áreas de búsqueda visual, no contornos ni puntos de montaje certificados. Los anclajes definitivos de esas piezas siguen vacíos intencionalmente.
6. Generar cada alternativa desde la misma maestra; mantener neumáticos, distancia entre ejes, altura y contornos de carrocería. Producir llantas de acero y aleación, dos ópticas halógenas de época, dos paragolpes y máscara de pintura. Para reemplazar solo el inserto de llanta, conservar neumático, borde y oclusión coherentes.
7. Mantener originales del generador aparte de capas preparadas. Si devuelve blanco o un damero dibujado, registrar ausencia de alfa y no aprobarlo como transparencia.
8. Verificar superposición a escala 1:1 con la maestra: centros, radios, bordes, sombras, ausencia de fugas y dobles contornos. Guardar composición de cada variante y comparación. No desplazar ni deformar cada resultado por separado para ocultar cambios de geometría.
9. Una máscara binaria debe seleccionar únicamente superficies pintadas. No incluir ensanches negros, vidrio, lámparas, llantas, neumáticos, estribos o fondo. Validar su registro antes de conectarla al selector de pintura.
10. Hasta completar esas pruebas, declarar las variantes como ausentes y mantener el SUV fuera del catálogo de piezas utilizables. El gráfico de coordenadas no reemplaza una composición de montaje.

## Bloqueo y alcance

Google Chrome expone una ventana titulada “Google Flow: nov 10 - 15:04”. El control de Windows devolvió `FrameArrived timed out: timed out waiting on channel` al capturarla. Después de renovar la selección de ventana y activarla, la recuperación devolvió `window capture timed out: timed out waiting on channel`.

No se pudo observar el editor ni comprobar su modelo, precio, referencia adjunta o resultados. Por ello no se enviaron prompts ni solicitudes de generación en este turno. No se consumieron créditos desde estas acciones. Reintentar más lentamente la escritura no resuelve un fallo previo a poder observar la ventana. No se sustituyó Flow por un servicio pago.

Las cadenas exactas usadas por el usuario para generar las cuatro propuestas no están incorporadas en los archivos recibidos. Se conserva el nombre original y no se inventa esa trazabilidad. Los prompts 6–12 del chat siguen siendo instrucciones pendientes de ejecución.

El mapa y el árbol tecnológico siguen pendientes. La prioridad continúa siendo completar y verificar este SUV antes de ampliar el catálogo.

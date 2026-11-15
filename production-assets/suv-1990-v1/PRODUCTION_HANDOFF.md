# SUV 1990 — imágenes generadas y prototipo de montaje

## Resultado comprobado

Se generaron **12 imágenes reales con la herramienta integrada de ChatGPT**, usando siempre `sources/proposal-01.jpg` como referencia. No se generaron con Flow ni Higgsfield. Los PNG originales del generador están en `generated/`, sin modificación. `generated/prompts.json` contiene los 12 prompts exactos; `generated/manifest.json` registra formato, tamaño, alfa, SHA-256 y estado.

Esta entrega contiene cuatro capas utilizables **en el prototipo con la imagen 1**: dos llantas y dos interiores de ópticas. Se comprobaron mediante composiciones reales. Todavía no es el kit completo de carrocería transparente, pintura y paragolpes desmontables terminado.

## Archivos para Claude Code

Todas las rutas parten de `production-assets/suv-1990-v1/`.

| Archivo | Uso real | Estado |
| --- | --- | --- |
| `sources/proposal-01.jpg` | Maestra de geometría; original inalterado 2752 × 1536 | Referencia elegida, fondo blanco opaco |
| `layers/rims-steel-registered.svg` | Dos llantas de acero, seis fijaciones, alfa exterior | Capa utilizable en prototipo; montaje revisado |
| `layers/rims-alloy-registered.svg` | Dos llantas de aleación, seis fijaciones | Capa utilizable en prototipo; montaje revisado |
| `layers/headlamp-a-registered.svg` | Interior óptico halógeno estriado dentro de abertura fija | Inserto utilizable en prototipo; montaje revisado |
| `layers/headlamp-b-registered.svg` | Interior óptico con reflector alternativo | Inserto utilizable en prototipo; montaje revisado |
| `layers/bumper-face-a-registered.svg` | Ensayo de cara de paragolpes estándar | Pendiente: transición visible en material |
| `layers/bumper-face-b-registered.svg` | Ensayo de cara metálica | Pendiente: costuras/artefactos de borde |
| `generated/cutout-v1-original.png` | Recorte del SUV con alfa real | Referencia: conservar bordes y fidelidad pendiente de corrección; no sustituir silenciosamente la maestra |
| `generated/paint-mask-v1-original.png` | Máscara generada | Pendiente: contiene 256 valores de gris y contornos aproximados |
| `MODULAR_PREVIEW.html` | Selector local de ruedas, ópticas y ensayos de caras de paragolpes | Vista de revisión; lógica no comprobada en navegador en este turno |
| `qa/rims-v2-mounted-review.png` | Composición real de ambas llantas + detalle ampliado | Prueba visual revisada |
| `qa/inserts-mounted-review.png` | Composición real de ambas ópticas y caras de paragolpes | Prueba revisada; evidencia también de defectos pendientes |
| `qa/raw-components-fit-review.png` | Intentos iniciales sin corregir registro local | Evidencia de fallos; no copiar al juego |
| `qa/cutout-mask-review.png` | Fondo claro/oscuro, recorte y máscara superpuestos | Evidencia de revisión, no assets de juego |
| `qa/sprite-mounts.json` | Pivotes, radios, escala uniforme y centros de rueda | Contrato del prototipo |
| `qa/insert-mounts.json` | Contornos de abertura, origen y escala de cada inserto | Contrato del prototipo |

## Registro y composición: qué se corrigió realmente

El generador no mantuvo el lienzo 2752 × 1536: las primeras capas fueron de aproximadamente 1678 × 937. Su superposición directa mostró llantas sobredimensionadas, desplazamientos y faros demasiado grandes. Esos archivos no se aprobaron como capas alineadas.

Para las llantas se generó una segunda versión como **una pieza individual reutilizable** de 1254 × 1254. Las dos posiciones usan el mismo sprite y la misma escala uniforme; no se deforman discos, neumáticos ni carrocería. Los montajes se declaran explícitamente, no se oculta la deriva original del generador.

Coordenadas de referencia: origen arriba a la izquierda, vehículo hacia la izquierda. Centros elegidos del prototipo: delantero `(566,1115)`, trasero `(2094,1115)`. Radio de inserción metálica: `134 px`. Los dos centros comparten la misma línea horizontal. El diagnóstico circular inicial sigue en `qa/anchors.provisional.json`; no confundir centro de neumático estimado con el contrato definitivo de este prototipo.

Las llantas presentan una pequeña desviación de circularidad propia del dibujo: relación ancho/alto de aproximadamente 0,981 para acero y 0,990 para aleación. Se conserva sin estiramiento anisotrópico. A tamaño de juego no altera el encaje; para catálogo técnico o giro animado conviene corregir esa circularidad antes de aprobarlas como producción final.

Las ópticas usan sprites de detalle generados por separado, una escala uniforme y un recorte SVG definido dentro de la abertura original. Cambia **solo el interior del lente**; se conservan marco, señalizadores y carrocería. La variante B usa el campo óptico central del sprite; no se promete que queden visibles las dos cámaras completas de su generación original. Las franjas de alfa defectuosas fuera de los sprites quedan excluidas por el recorte SVG, pero se conservan en el original para trazabilidad.

Las capas SVG tienen lienzo fuente 2752 × 1536, alfa fuera de las piezas e imágenes raster reales incrustadas; no son ilustraciones sustitutivas dibujadas con código. El código únicamente fija montaje y recorte.

## Integración en React

1. Usar un SVG padre con `viewBox="0 0 2752 1536"`. Colocar la maestra como `<image width="2752" height="1536" href=".../sources/proposal-01.jpg" />`.
2. Encima, colocar **una sola** capa de llantas y **una sola** de ópticas con el mismo tamaño y origen. Las capas ya contienen las coordenadas: no centrarlas por su área visible ni usar `object-fit: cover` por pieza.
3. Para el objetivo 1600 × 700, aplicar a TODO el conjunto una única transformación: `translate(1.402390438 -117.61752988) scale(0.5737051793)`. La vista local lo demuestra sin estirar la carrocería.
4. Conservar opciones ausentes para los paragolpes completos y el selector de pintura. Las caras de ensayo no reemplazan un paragolpes estructural desmontable.
5. El JPEG base sigue opaco. Hasta obtener un recorte de fidelidad aprobada, este prototipo se presenta sobre blanco. No declarar esta limitación resuelta por el mero hecho de existir un PNG con alfa.
6. No reutilizar anclajes de GT01 ni modificar economía, simulador, normativas o guardados. No ampliar el catálogo a otro vehículo todavía.

## Verificación y limitaciones

Se inspeccionaron los doce resultados, los canales alfa, los componentes conectados y las composiciones sobre el original. Las pruebas ampliadas muestran tanto los montajes aceptados para prototipo como los rechazos. La página HTML se preparó para revisión local; el control del navegador falló y no se afirma haberla probado dentro de Chrome.

Pendiente antes de llamar a esto un kit modular definitivo: recorte de carrocería fiel con bordes limpios, máscara de pintura registrada y binaria, dos paragolpes completos sin costuras, circularidad final de las llantas y comprobación en el editor real de React. No se consumieron créditos de Higgsfield ni se utilizó una API paga externa.

## Reproducción

`build_modular_review.py` produce las mediciones, capas de llantas y pruebas de superposición desde los archivos existentes. Después, `assemble_inserts.py` construye las capas de lentes, los ensayos de paragolpes y la vista local. No hace falta volver a generar imágenes. Estos scripts no redibujan el automóvil ni modifican los PNG originales.

`ASSET_HANDOFF.md` conserva el registro del checkpoint anterior; para el estado actual prevalece este documento.

## Ensayos adicionales de máscaras nativas — todavía no aprobados para el juego

`prepare_native_masks.py` prepara dos alternativas SVG a partir de archivos existentes, sin nuevas generaciones ni alteración del JPEG:

- `layers/body-source-masked.svg`: aplica el alfa del recorte generado a los píxeles del original, con una sola escala uniforme y erosión de 1 px de fuente. La revisión en `qa/native-masks-review.png` todavía revela un borde claro sobre azul oscuro: **pendiente de limpieza**, no maestra final.
- `layers/paint-selection-source.svg`: selecciona el verde directamente sobre la fuente, mediante umbrales de canales sRGB y exclusiones de ventanas. La prueba de color azul muestra el registro sobre la carrocería y la exclusión de vidrio, ruedas, luces y plásticos. Es una selección específica de esta fuente verde, no un procedimiento general para otros vehículos. **Pendiente de validar el render SVG real en navegador y de exportar/verificar una máscara PNG de producción**.

`qa/native-masks.json` registra reglas y límites. La figura es una composición de diagnóstico que reproduce los filtros; no se presenta como una captura del navegador. Estos dos ensayos no amplían la lista de cuatro capas aprobadas para el prototipo.

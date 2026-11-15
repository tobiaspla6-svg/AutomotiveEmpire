# Automotive Empire — producción de assets GT-01

## Estado comprobado

**Producción bloqueada en la primera carrocería. No hay un prototipo modular aprobado.** Se revisaron las siete selecciones anteriores y sus JPEG originales. Se descargó de Google Flow el GT azul coincidente visualmente con el adjunto del usuario. La primera edición de ese original y su reintento devolvieron «Detectamos actividad inusual», con «No se te cobró por esta generación». No se enviaron las otras tres propuestas ni se generaron piezas para aparentar avance.

El original y la evidencia se conservan. En `generation-log.json` se distingue cada solicitud real del trabajo pendiente; `manifest.json` lista solamente archivos existentes. Las referencias heredadas no se presentan como producción nueva.

Rama nueva: `art/production-gt01-20261115-01a1dd27`, basada en `art/flow-reference-20261115-01a1dd27`. No modificar `main` ni fusionar PRs. La autorización de publicación y las restricciones de costo de esta conversación siguen vigentes. No activar planes ni pruebas con renovación.

## Archivo de autoridad del vehículo

`gt-blue-v1/sources/user-gt-blue-original.jpg`: JPEG RGB, 1376×768, sin canal alfa, cero píxeles transparentes. Descarga original, sin retoque ni reescalado. No es un PNG transparente y el fondo claro no significa transparencia.

SHA-256: `d5ff9b7b219e5e0c3f710134de68ed24339f57bc867ca59c249cdfaa9d54c20d`.

Original editable en Flow: `https://flow.google.com/project/f5743459-f45c-4104-8080-5f073fbe1c29/edit/6042d57e-8631-46f4-b250-95559aaa770e`.

GT fastback de cuatro puertas, azul metálico, mirando a la izquierda. Mantener esta familia, techo, pilares, proporciones y superficies. No sustituirlo por el sedán de otro diseño de pantalla. Las siete pantallas fijan la identidad ambiental y el acabado, no una geometría distinta del GT.

## Escala y mediciones

El objetivo de producción sigue siendo **1600×700**. El original descargado no tiene esas dimensiones. Flow ofrece «Original» y proporciones prefijadas; no se verificó una exportación nativa 1600×700.

Se midieron contornos de neumáticos sobre el original con detección de círculos y se revisó visualmente la anotación `gt-blue-v1/qa/source-wheel-measurements.png`. Son estimaciones de raster, con incertidumbre aproximada ±3 píxeles; no datos CAD ni anclajes finales de una carrocería todavía no aprobada:

| Anclaje de referencia | x | y | Radio estimado |
|---|---:|---:|---:|
| Rueda delantera, izquierda | 321.5 | 478.5 | 92.1 |
| Rueda trasera, derecha | 1052.5 | 477.5 | 92.1 |

Línea inferior de referencia: y≈570.6. Una transformación uniforme candidata al lienzo de producción es `x'=x×7/6−8/3`, `y'=y×7/6−75.7`, con suelo objetivo y=590. No se exportó una imagen modificada con esta transformación ni se la aprobó. Aplicar la misma transformación al conjunto de capas, nunca una escala independiente por pieza. La diferencia de aproximadamente un píxel entre los centros y la leve perspectiva del original deberán resolverse al escoger la base ortográfica; después se congelan los anclajes medidos de esa base.

El primer prompt enviado usó centros aproximados antes de la medición detallada. Al reanudar, usar los valores medidos anteriores o los anclajes de la base elegida. No convertir aquel texto aproximado en coordenadas finales.

## Orden para reanudar la prioridad 1

1. Resolver el bloqueo normal de Flow. El paso manual solicitado es pulsar «Reintentar» una sola vez sobre la tarjeta fallida del GT. Si sigue rechazado, conservar la evidencia y esperar la resolución del servicio. No intentar eludir la detección con cuentas, extensiones o endpoints alternativos.
2. Crear las cuatro propuestas A–D desde el mismo original, de una en una. Los prompts están en `gt-blue-v1/prompts/base-proposals.json`; A fue enviada y rechazada, B–D siguen sin enviar. Las diferencias se limitan a claridad de materiales y acabado. No variar cámara, posición, escala o silueta para fabricar diversidad.
3. Descargar cada resultado original; registrar dimensiones/formato/alfa reales. Comparar fidelidad, perfil ortográfico, proporciones, centros de ruedas y límites de montaje. No elegir solo por el brillo de la pintura.
4. Elegir una base únicamente después de examinar las cuatro imágenes. Guardarla inmutable con su hash y sus puntos medidos. Si ninguna conserva la geometría, corregir o mantener todas como referencia.
5. Editar una sola familia de piezas por vez, siempre partiendo de la base elegida, nunca de la variante anterior. Mantener las ruedas, suelo, pilares y anclajes congelados. Pedir capas transparentes en su posición original, sin recentrar las piezas aisladas.

### Piezas solicitadas y aún pendientes

| Grupo | Variantes | Estado actual |
|---|---|---|
| Carrocería | Estándar | Pendiente de elegir base A–D |
| Llantas | Multirradio y cinco radios, mismo diámetro | No generadas |
| Faros | Dos diseños en la misma envolvente | No generados |
| Paragolpes delantero | Estándar y deportivo, mismos límites/anclajes | No generados |
| Manijas | Convencionales y enrasadas, mismas ubicaciones | No generadas |
| Techo | Fijo, panorámico y panel solar | No generados |

No etiquetar un vehículo entero con una llanta distinta como «llanta transparente utilizable». Si Flow solo devuelve vehículos completos y cambia la geometría, guardar como referencia o pendiente de corrección. Los descapotables de lona y techo rígido retráctil requieren una **familia estructural independiente** si cambian marco superior, pilares, vano o carrocería trasera. No son una capa que se borra encima del techo fijo.

## Prueba obligatoria de montaje

`gt-blue-v1/qa/verify_assets.py` inspecciona alfa y compara una edición con su base sin registrarla ni deformarla para ocultar desplazamientos. En su calibración actual usa el lienzo nativo del original; recalibrar al seleccionar la nueva base o exportar el master. No aplicar sus ventanas de detección universalmente a cualquier coche.

Para cada pieza: verificar mismo lienzo, alfa realmente no opaco, pivote, escala, máscara, solapamiento y ocultamiento. Componer la base con la pieza en las coordenadas registradas, mostrarla sobre fondo oscuro y marfil, y generar una superposición al 50%. Comprobar visualmente doble contorno en ruedas, cristales, pilares y carrocería. Comparar las zonas no editadas: el objetivo es cero píxeles alterados fuera de la región permitida; una diferencia de compresión se documenta, no se oculta con un registro automático. La tolerancia inicial de centro de rueda es 2 píxeles nativos; también revisar diámetro, círculos y línea del suelo.

Cambiar ambas llantas sin mover los centros. Faros, manijas y paragolpes deben mantener su envolvente y sus puntos de unión. Un techo panorámico o solar no puede aumentar la altura del coche ni desplazar pilares. Guardar la imagen de composición, el informe de diferencias y la evaluación visual. Una prueba contra la misma imagen solo comprueba el funcionamiento del diagnóstico; no valida una variante.

**No se ejecutó una superposición de variantes reales porque Flow no entregó ninguna.** El informe del original dice `modularComposition: not_run`. La anotación de ruedas es diagnóstico del original, no un componente generado ni un prototipo modular terminado.

## Prioridad 2 — fondos limpios

Se copiaron sin cambios las siete selecciones a `clean-backgrounds/originals/`, conservando sus hashes. `clean-backgrounds/results/` permanece vacío. No se generaron versiones limpias mientras la prioridad 1 sigue bloqueada.

Al reanudar, editar cada original por separado: quitar letras, botones, HUD y estadísticas y reconstruir únicamente las áreas cubiertas. Conservar arquitectura, luz, perspectiva, encuadre, materiales y composición. No rediseñar el mundo. Para fondos del taller y garaje, separar además el vehículo seleccionable en una entrega posterior, conservando el piso y las zonas de exhibición. No introducir autos nuevos para llenar zonas donde antes había botones. Guardar fuente y resultado por separado y registrar toda reconstrucción ambigua.

## Prioridad 3 — referencias de video

No se generaron imágenes de estados ni videos. No se verificó costo cero de los modelos de video: el indicador «0 créditos» observado correspondía a la edición de imágenes con Nano Banana 2.1, no autoriza asumir lo mismo para video.

Video A: partir de una única caja legendaria dorada aprobada, generar estado cerrado y estado abierto conservando caja, herrajes, bisagras, perspectiva y luz ambiental. Si Flow permite fotogramas inicial/final, usarlos. La tapa debe rotar sobre bisagras físicas, aparecer luz interior y revelarse una pieza mecánica. Rechazar deformaciones de caja o cierres que cambian de lado. Guardar ambos estados, video original, duración, codec, fps y resolución reales. Si el modelo consume créditos pagos, no enviar sin autorización.

Video B: usar la estación de fábrica de la referencia A. Cámara fija, plano único, mismo coche y arquitectura, brazos con movimiento mecánicamente coherente y avance lento sobre la línea. Sin cortes ni nuevos textos. Examinar inicio, mitad y final para detectar deriva. Guardar original y metadatos. Son referencias de movimiento: evaluar sprites, capas, SVG/canvas y animación de transformaciones antes de incorporar MP4 pesado al juego.

## Contrato para Claude Code

- Consumir exclusivamente archivos existentes del manifiesto. No generar imágenes automáticamente para llenar huecos.
- Estados válidos: `referencia`, `asset utilizable`, `pendiente de corrección`. No hay assets modulares utilizables aprobados en este estado de la entrega.
- Mantener separados `sources`, `originals`, resultados y QA; no sobrescribir un original durante correcciones.
- Guardar `bodyFamilyId`, `anchorVersion`, pieza, máscara, centro/pivote, dimensiones, origen de coordenadas, transformaciones y compatibilidades.
- No extraer una pieza con un recorte a ojo y declarar que quedó alineada. No agregar un canal alfa totalmente opaco y llamarlo transparencia.
- No ampliar el catálogo a otros vehículos antes de aprobar el montaje del GT-01.



## Continuación tras el reintento manual

Se comprobó el reintento informado por el usuario. Un reintento normal llegó a mostrar 0 %, pero terminó nuevamente en «Detectamos actividad inusual». Después se envió una única edición nueva con una instrucción más breve y los centros de ruedas medidos; se esperó su finalización antes de cualquier otra solicitud. También fue rechazada y Flow indicó que no hubo cobro. El historial mantuvo una sola imagen: el original. No se generaron las propuestas B–D ni piezas.

El prompt adicional está en `gt-blue-v1/prompts/A-short-retry.txt`; la evidencia actual está en `gt-blue-v1/qa/flow-retry-current.png`. Ambos archivos se conservan localmente y se adjuntan en la actualización de evidencia. El checkpoint ZIP anterior es histórico y no contiene estos dos archivos adicionales. La producción sigue bloqueada y el prototipo modular no ha sido verificado. El siguiente paso depende de que Flow permita completar una edición manual o se resuelva el rechazo del servicio; no se seguirán acumulando solicitudes automatizadas fallidas.

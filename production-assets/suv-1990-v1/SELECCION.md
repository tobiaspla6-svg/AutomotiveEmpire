# SUV 1990 — selección artística

Seleccionada: `sources/proposal-01.jpg`, original de Flow proporcionado por el usuario, 2752 × 1536, JPEG RGB. Referencia visual elegida; todavía no es un asset modular.

Se revisaron visualmente las cuatro imágenes adjuntas individualmente. Numeración por orden del mensaje del usuario; no equivale a las letras de los prompts originales.

| Imagen | Evaluación visual | Decisión |
| --- | --- | --- |
| 1 | Mejor separación de pintura verde, ensanches negros, vidrio y metal. Volumen suave, ópticas legibles, carrocería completa y contornos de componentes claros. | Maestra visual elegida. |
| 2 | Silueta clara y buen perfil; pintura más plana y ensanches del mismo color que la carrocería. Pierde contraste entre materiales frente a la 1. | Alternativa secundaria. |
| 3 | Buen volumen y detalle, pero agrega barras de techo y manijas cromadas. Introduce equipamiento que complica una base neutra. | Conservar como referencia de acabado. |
| 4 | Estética lograda y estribo bien definido, pero cristales muy oscuros, más accesorios y archivo de menor resolución (1376 × 768). | Conservar como referencia; no seleccionada. |

## Preparación pendiente

- Fondo blanco y sombra están incrustados. Los cuatro archivos carecen de canal alfa; el PNG de la imagen 4 también es RGB.
- Separar sombra y fondo, manteniendo contornos, antenas o detalles pequeños si existiesen, sin halos blancos. Revisar sobre fondos claros, oscuros y saturados.
- Revisar y fijar la tornillería de los dos bujes antes de aprobar las llantas intercambiables; el detalle generado no debe considerarse un patrón mecánico validado.
- La imagen elegida tiene perfil visualmente adecuado. No se certificó ortografía mediante una referencia técnica.
- Congelar una única transformación uniforme para pasar al lienzo de producción 1600 × 700: recortar márgenes vacíos y escalar proporcionalmente, sin comprimir la carrocería. No volver a encuadrar cada componente por separado.
- Medir centros de ruedas, radios, suelo, límites de faro y uniones del paragolpes sobre esa maestra final; no inventar coordenadas por prompt.
- Generar cada variante desde la misma imagen 1, nunca desde otra alternativa ni encadenando variantes. Las cuatro propuestas cambian geometría y encuadre: sus piezas no son intercambiables entre sí.
- No quitar las ruedas completas como primera edición: conservar la maestra intacta y preparar capas de forma controlada. Una apertura transparente en el neumático sin respaldo no constituye una base utilizable.
- Mantener faros y paragolpes dentro de la huella lateral visible: no mostrar una parrilla frontal que fuerce perspectiva de tres cuartos.

## Verificación pendiente

No se recibieron piezas separadas y no se realizó una prueba de montaje. Transparencia, alineación y encaje modular: pendientes. La selección aprueba la dirección visual, no la integrabilidad final.

Los originales se copiaron sin alteración; dimensiones, formato y SHA-256 están en `review-metadata.json`. No se generaron nuevas imágenes, no se consumieron créditos y este paquete todavía no fue publicado en GitHub. Los prompts exactos de las generaciones no están incluidos en los archivos suministrados y no se atribuyeron por el nombre del archivo.

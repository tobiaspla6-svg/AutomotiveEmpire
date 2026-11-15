# Fase 6 — SUV 1990 modular y prototipo de Tuning Empire

- **Rama:** `phase6-suv-modular-tuning`, derivada de `phase5d-modular-gt` (f17c4e0, PR #17).
- **Sin cambios:** no se fusionó nada; `main` y las ramas anteriores no se tocaron.
- **Rama artística:** `art/suv90-master-20261115-01a1dd27` se leyó sin modificarla. Sus originales se conservan allí intactos; aquí sólo hay derivados, cada uno con el hash de su fuente.
- **Sin servicios pagos:** no se usó Higgsfield ni ninguna API paga, y no se generaron imágenes nuevas.

Auditoría y línea base: [`AUDIT.md`](AUDIT.md). Física del prototipo: [`TUNING.md`](TUNING.md).

## Estado por función

| Función | Estado | Evidencia |
|---|---|---|
| `MODULAR_PREVIEW.html` de la rama artística, verificado en Chromium (3 llantas × 3 faros + 2 ensayos de paragolpes, a 1920 / 1280 / 390 px) | **FUNCIONAL Y PROBADA** | [`modular-preview/`](modular-preview/), `preview-report.json`: 0 errores de consola y 0 respuestas fallidas; los pivotes de las llantas caen en (566,0; 1115,0) y (2094,0; 1115,0). |
| Carrocería del SUV con alfa real desde `proposal-01.jpg` | **FUNCIONAL Y PROBADA** (calidad de prototipo) | [`suv90-qa/backgrounds.webp`](suv90-qa/backgrounds.webp): fondos blanco, negro, azul y gris. Recomposición con error medio de 0,27 niveles. Halo: luma media del borde sobre negro 13,5. |
| Sombra separada | **FUNCIONAL Y PROBADA** | Capa propia `shadow.webp`. Bajo el chasis, entre ruedas, se ve el fondo. |
| Máscara de pintura y selector de color | **FUNCIONAL Y PROBADA** | [`suv90-proof/sheet-paint.webp`](suv90-proof/sheet-paint.webp): verde original, blanco, negro, rojo, azul y gris metálico. **0 píxeles cambiados fuera de la máscara** en los 6. El verde original no lleva capa de repintado. |
| Llantas (original, acero de 6 tuercas, aleación de 6 rayos) y faros (original, A, B) en el taller y el garaje reales | **FUNCIONAL Y PROBADA** | [`suv90-proof/sheet-combos.webp`](suv90-proof/sheet-combos.webp): las 9 combinaciones con **0 píxeles fuera de sus capas**; volver al original da 0 px de diferencia. |
| Paragolpes intercambiables | **PENDIENTE** (rechazado) | [`suv90-qa/bumper-trials-review.webp`](suv90-qa/bumper-trials-review.webp). El ensayo A pierde el contorno y deja un corte duro; el B tiene doble contorno, costura y un gancho agregado. No se ofrecen en el juego. |
| Guardado por vehículo y recuperación (taller → garaje → recargar la página) | **FUNCIONAL Y PROBADA** | Test e2e `SUV 1990 family…`. Los tests unitarios cubren la ida y vuelta por JSON y `saveDamage`. |
| Familias de vehículo por datos (`VehicleArtFamily`, validador, `ModularCar`) | **FUNCIONAL Y PROBADA** | `tests/suv90-modular-6.test.ts` (16 tests). |
| Separación entre lo visual y lo mecánico | **FUNCIONAL Y PROBADA** | Un test verifica que guardar piezas visuales no cambia dinero, especificación, estadísticas ni precio. |
| Migración del GT-01 al formato de familia | **PENDIENTE** (a propósito) | El GT-01 sigue con su renderizador de la fase 5D, como se pidió: "no migres todos los vehículos todavía". |
| Motor de drag de Tuning Empire (física, piezas, compatibilidad, Stages, ECU) | **EXPERIMENTAL**, con pruebas | `tests/tuning-drag.test.ts` (18 tests) y validación contra Hale/Huntington. |
| Laboratorio de Tuning Empire (`tuning.html`) | **EXPERIMENTAL**, probado en navegador | [`tuning-lab/`](tuning-lab/) a 1920 / 1280 / 390 px y test e2e `Tuning Lab…`. |

## SUV 1990 en el juego

- **Proceso:** `scripts/suv90/prepare_suv90.py` (OpenCV; no genera píxeles, sólo recorta, desmezcla y monta).
  - **Fondo:** relleno de lo blanco conectado al borde, más el blanco encerrado bajo el chasis y los huecos casi blancos (ojos de los ganchos, detrás del limpiaparabrisas). Los brillos de las ópticas quedan como parte del auto.
  - **Bordes:** desmezcla de la tinta contra el blanco en una banda de 2 px, así que no hay halo blanco. Quedan 36 píxeles claros en el borde, todos del montante A y el parabrisas, que son claros en el dibujo.
  - **Sombra:** franja de suelo bajo la carrocería, en capa negra aparte con alfa igual al oscurecimiento.
  - **Pintura:**
    - Se selecciona por tono sobre la fuente: verde con g−r > 8 y g−b > 7.
    - Quedan excluidos, con sondas en el manifiesto: vidrios, guardabarros negros, franja lateral, paragolpes, estribo, espejo, manijas, ópticas, intermitentes, ruedas, sombra y fondo.
    - El borde inferior del lateral trasero se suavizó porque daba puntos oscuros al repintar en blanco.
  - **Llantas y faros:** se montan con los contratos medidos en la rama artística: una escala uniforme y el pivote sobre el buje, sin estirar nada. Cada llanta es un solo archivo montado en los dos ejes.
- **Lienzo:** 1376 × 590, con una sola transformación: `lienzo = (fuente − (0, 220)) × 0,5`.
- **En el juego:** la familia `suv90-green` dibuja los SUV con año de diseño entre 1984 y 2004. Por ejemplo, en una partida de Toyota de 1995 el garaje muestra el Land Cruiser 60/80 y el RAV4 con este dibujo.
  - La familia representa a todos los SUV de esa época con un mismo dibujo, igual que el GT-01 representa a los sedanes desde 2005.
  - El taller ofrece sólo las piezas de esa familia; una categoría sin variantes lo dice.
- **Peso de carga:** unos 142 kB en total para la familia (carrocería 81, sombra 23, máscara 22, variantes 17). Las variantes se descargan sólo al elegirlas; el registro de red de la prueba lo confirma (`suv90-proof/render.json`).

**Defectos pendientes del SUV:**
- **Paragolpes completos.** Hace falta arte nuevo: los ensayos A y B no sirven.
- **Pintura con matiz.** La máscara es específica de esta fuente verde. En los colores claros el repintado conserva el volumen, pero el blanco queda gris claro, porque la pintura original es oscura y el modelo de aclarado tiene un tope.
- **Circularidad de las llantas.** Proporciones 0,981 y 0,990, sin corregir: no alcanza para animar un giro.
- **Ganchos de remolque.** Sobre fondo negro, a 600 % de zoom, quedan algunos píxeles grises sueltos alrededor del ojo del gancho. A tamaño de juego no se ven.

## Tuning Empire

Ver [`TUNING.md`](TUNING.md). Resumen de resultados (cuarto de milla, desde el primer movimiento):

| Auto / preparación | Potencia | 60 ft | 1/4 milla | Trampa |
|---|---|---|---|---|
| Kestrel GT-T RWD de serie | 178 kW | 2,92 s | 15,62 s | 158 km/h |
| Kestrel Stage 2 + embrague + LSD + radiales | 258 kW | 2,14 s | 12,79 s | 183 km/h |
| Kestrel Stage 3 con transmisión de serie | 306 kW | 2,92 s | 15,07 s | 176 km/h |
| Atlas 4WD de serie | 178 kW | 2,34 s | 14,85 s | 151 km/h |

## Pruebas ejecutadas

- **`npm run ci`:** typecheck; vitest con **48 archivos y 613 tests aprobados** (línea base: 46 / 579); build de producción con las dos páginas. Se volvió a correr después de cada cambio importante.
- **`node e2e/run.cjs`:** **19 de 19** en Chromium (línea base: 17), incluidas las pruebas nuevas del SUV y del laboratorio.
- **`e2e/proof-suv90.cjs`:** juego real, 9 combinaciones, 6 colores y vuelta al original.
- **`e2e/check-modular-preview.cjs`:** el preview de la rama artística.
- **`e2e/shots-tuning.cjs`:** el laboratorio a tres tamaños.
- **Juego original:** CI y suite e2e completos en verde, y el test del laboratorio vuelve a abrir el menú del juego.

## Reproducir

```bash
git worktree add /tmp/suvart origin/art/suv90-master-20261115-01a1dd27
python3 scripts/suv90/prepare_suv90.py /tmp/suvart/production-assets/suv-1990-v1 public/flow/suv90 /tmp/suvqa   # necesita opencv
npx vite build && node e2e/proof-suv90.cjs docs/phase6/suv90-proof
node e2e/check-modular-preview.cjs /tmp/suvart/production-assets/suv-1990-v1 docs/phase6/modular-preview
node e2e/shots-tuning.cjs docs/phase6/tuning-lab
```

## Próximas tres tareas recomendadas

1. **Paragolpes del SUV.** Generarlos o dibujarlos como piezas completas sobre `proposal-01.jpg` (mismo lienzo, contorno de tinta continuo) y pasarlos por la misma prueba de 0 px fuera de zona.
2. **Migrar el GT-01 al contrato `VehicleArtFamily`.** Que un solo renderizador dibuje las dos familias, y sumar una tercera (hatchback o pickup) para probar el contrato con arte nuevo.
3. **Primer bucle jugable de Tuning Empire.** Un cliente con presupuesto y objetivo de tiempo, compra de piezas, banco y carrera, con guardado. Reutilizar el guardado, la i18n y la UI Flow de Automotive Empire, y reemplazar el modelo de neumático por una curva de deslizamiento.

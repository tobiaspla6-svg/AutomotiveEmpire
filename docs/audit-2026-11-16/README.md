# Correcciones de la auditoría jugable del 16/11/2026

- **Rama:** `fix/audit-2026-11-16`, derivada de `phase6-suv-modular-tuning` (PR #18).
- **Sin cambios:** no se fusionó nada; `main` no se tocó.
- **Origen:** el dossier `DOSSIER_AUTOMOTIVE_EMPIRE_FABLE_5_2.docx` (diez defectos AE-01…AE-10 y la investigación R-01), auditado sobre `main` df1bac6. Ese commit es ancestro de esta rama, así que cada defecto se volvió a comprobar aquí antes de corregirlo.
- **Lo que no recibí:** el paquete `AUDITORIA_AUTOMOTIVE_EMPIRE.zip` (52 capturas, estados, saves). Trabajé con el texto del dossier y con reproducciones propias; no vi esas capturas.

## Estado por defecto

| ID | Defecto | Qué se hizo | Verificación |
|---|---|---|---|
| AE-01 (P1) | Un espacio en el importador avanzaba el mes. | Ya estaba corregido en las ramas de la fase 4D. Se reforzó: Space no avanza si el foco está en cualquier control editable ni si hay un diálogo abierto. | e2e `audit AE-01`: 10 espacios, texto multilínea y pegado no cambian fecha ni caja; Space fuera de formularios sigue avanzando un mes. |
| AE-02 (P1) | "A plena capacidad" guardaba las unidades del momento: una línea ampliada de 300 a 400 seguía fabricando 300. | "Plena capacidad" es ahora un valor propio (`LINE_FULL`), distinto de un objetivo mensual absoluto. Ampliar una línea que estaba a tope la deja a tope, y al cargar una partida vieja los valores congelados del jugador se convierten. | 4 tests: 300 → 400 sin tocar el selector; partida vieja con el 300 congelado (defecto reproducido, y corregido al cargar); un objetivo absoluto menor se respeta; "Seguir la demanda" no sobreproduce. |
| AE-03 (P2) | El presupuesto del modo Director en el setup no coincidía con el equipo creado. | El setup llama al constructor real (`previewMotorsport`) con la misma semilla que usa la partida. Muestra coste anual, financiación garantizada, premio condicionado y margen. | 9 combinaciones de presupuesto × dificultad, más instalaciones, personal y objetivo. e2e: propietario, patrocinadores y caja del setup = los del equipo creado. |
| AE-04 (P2) | La ayuda de la primera inversión regional no descontaba el coste de entrada. | `dealerInvestPreview` es la única fuente para la acción y las dos pantallas. La ayuda desglosa entrada + red → alcance neto. | Test: región nueva, región existente e importe menor que la entrada (rechazado sin cobrar). |
| AE-05 (P2) | La confirmación de adquisición no informaba caja ni deuda asumidas. | `acquisitionPreview` ejecuta la compra real sobre una copia y el diálogo muestra precio, caja recibida, deuda asumida, caja y deuda antes → después, crédito restante, plantas, modelos e ingenieros, con aviso si queda cerca del límite. | Test de identidades contables y de que previsualizar no cambia nada. e2e: Ferrari → Lamborghini da 62,5 → 64,7 M de caja y 78,2 → 90,3 M de deuda, las cifras del dossier; Cancelar no cambia nada. |
| AE-06 (P2) | "0 meses" mientras el programa esperaba una arquitectura compartida. | `devBlockers` y `devEtaMonths`: la tabla, la ficha y el tablero nombran la dependencia y dan su plazo ("Ingeniería lista · espera S1 platform (~N m)"), más una línea de ruta crítica en la ficha. | 2 tests. |
| AE-07 (P2) | El reloj del GT se truncaba en 2:00:00. | Muestra el tiempo real y el estado: "Tiempo cumplido: última vuelta del líder", "Bandera a cuadros: el resto completa su vuelta", "Carrera terminada". Las carreras por vueltas no cambian. | Captura real: `2:02:24 / 2:00:00 · Carrera terminada`. |
| AE-08 (P2) | "+3 meses" simulaba carreras sin avisar. | El avance por lote se detiene cuando aparece un fin de semana de carrera y avisa. Hay una opción explícita en Configuración → Juego para volver a la simulación automática. | 3 tests (se detiene sin resultados; con la opción activada es determinista; un mes solo no cambia). e2e: tras +3 no hay resultados guardados. |
| AE-09 (P3) | Objetivos con dos plazos ("by 1989" y "by 1990"). | El texto nuevo dice "in a calendar year, 1989 at the latest" y la etiqueta pasa a "revisión final: enero de 1990". Las partidas existentes conservan su texto, pero la etiqueta ya distingue la revisión. | Test. |
| AE-10 (P3) | Dimensiones del visor sin redondear y muestra vieja confundible. | Dimensiones redondeadas; si la calidad actual difiere de la medida, se avisa que es una medición anterior. | Revisión de código; no se midió en un equipo con GPU. |
| R-01 | 7 de 22 autos sin combustible al final de un GT. | **Aislado y corregido.** Ver abajo. | `scripts/audit/r01-gt-fuel.ts`, 2 tests. |

## R-01: causa aislada

`scripts/audit/r01-gt-fuel.ts` simula 24 carreras GT de dos horas (8 semillas × 3 rondas), con todos los estrategas en automático y sin intervención humana.

| | Autos | Sin combustible | De ellos, después del tiempo límite |
|---|---|---|---|
| Antes | 528 | 122 (23,1 %) | 116 |
| Después | 528 | 0 | 0 |

- **Causa:** el estratega cargaba combustible hasta el vencimiento del reloj. Una carrera cronometrada sigue después: el líder completa su vuelta y recibe la bandera, y cada auto completa la suya. Son hasta dos cruces de meta más. Cuanto más tarde caía la bandera, más autos se quedaban secos (0 con bandera a 120,0 min; hasta 17 con bandera a 121,6 min).
- **Cambio mínimo** (`src/sim/racing/race.ts`):
  - la carga cuenta esas dos vueltas en carreras cronometradas (`fuelLapsLeft`);
  - usa el consumo del ritmo actual (Push gasta 4 % más);
  - permite una parada de emergencia aunque quede menos de una vuelta de reloj.
- **Consecuencia que conviene decidir:** los retiros por combustible de los rivales le regalaban a un equipo privado de GT algún 6.º a 9.º puesto. Sin ellos, un privado que nunca desarrolla el auto termina último todos los años y los dueños lo reemplazan tras 14 a 16 temporadas (despido, no quiebra). El test de carreras largas exigía 20 temporadas y ahora acepta 14 para GT. No toqué la regla de confianza de los dueños: si querés que acepten el último puesto de un privado, es un cambio de diseño aparte.
- **Lo que no cambió:** el consumo, el coste del Push (más gasto y más paradas), las carreras por vueltas y la posibilidad de quedarse sin combustible con estrategia manual. Terminar después de las dos horas sigue siendo normal.

## Pruebas

- `tests/audit-2026-11-16.test.ts`: 24 tests.
- `e2e/run.cjs`: 3 pruebas nuevas (`audit AE-01`, `audit AE-03/AE-08`, `audit AE-05`).
- `e2e/shots-audit.cjs`: capturas reales en [`screens/`](screens/) y `screens/report.json`.
- Resultados de `npm run ci` y de la suite e2e: ver el PR.

## Pendiente del dossier (no incluido aquí)

- **Autosave por campaña.** Sigue siendo uno global; el menú ya avisa antes de reemplazarlo.
- **Fase 1:** caja hasta el primer lanzamiento y explicación de demanda y capacidad para un jugador nuevo.
- **Fases 3–4:** paragolpes del SUV, unidad poseída, tienda e inventario, y drag jugable con salida y cambios manuales. El prototipo de `src/tuning` es la base física, no un minijuego.
- **Fase 5:** mapa de seis mercados y árbol tecnológico (`phase5d-market-progression-foundation`, de otra sesión, no se integró).
- **QA no cubierto:** capital mínimo, quiebra, saves corruptos con JSON válido, otros navegadores, lectores de pantalla.

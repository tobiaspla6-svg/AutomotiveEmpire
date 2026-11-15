# Fase 6 — Auditoría técnica rápida (línea base)

Rama de integración: `phase6-suv-modular-tuning`.
- **Base:** `phase5d-modular-gt` (f17c4e0, PR #17), que tiene el editor modular del GT-01 y el sistema de configuración visual por vehículo.
- **Rama artística:** se leyó `art/suv90-master-20261115-01a1dd27` (75a8892) en un worktree aparte, sin fusionarla ni modificarla. Esa rama sale de `phase5d-market-progression-foundation` (PR #16, de otra sesión) y no se incorporó.

## Línea base medida antes de tocar código (commit f17c4e0)

| Comando | Resultado |
|---|---|
| `npm run ci` (`tsc --noEmit` + vitest + `vite build`) | Pasa: 46 archivos, 579 tests. |
| `npm run test:e2e` (Playwright, Chromium real) | 17/17. |
| lint | El proyecto no tiene script de lint. No se agregó ninguno para no sumar dependencias. |

## Estructura relevante

- **Stack:** React 19, TypeScript 7, Vite 8, Vitest 5, zustand 5 y three/r3f (sólo la vista 3D opcional). No se agregaron dependencias.
- **Simulación (`src/sim`):** determinista, con su propio RNG. `engineering.ts` ya integra una aceleración con paso explícito (0–100, cuarto de milla) a partir de la especificación de época de Automotive Empire, pero está acoplada a `VehicleSpec`, la tecnología del año y los puntajes de mercado.
- **Editor de vehículos:**
  - `src/ui/flow/FlowStudio.tsx` es el taller y `FlowGarage.tsx` el garaje.
  - `src/sim/vehicleConfig.ts` guarda la configuración visual por vehículo en `Company.designs` y la valida al cargar.
  - El GT-01 se dibuja con `GT01Car` (capas, máscara de pintura y piezas de `public/flow/gt01`).
- **Assets:** `public/flow/<familia>/…` con manifiestos JSON, generados por scripts reproducibles en `scripts/flow` (OpenCV, sin modelos generativos).
- **Guardado:** IndexedDB con exportación JSON. `sim/migrate.ts` (`saveDamage`) rechaza partidas dañadas. Las configuraciones visuales inválidas caen a valores por defecto y no rompen la carga.
- **Economía y progresión:** `sim/market.ts`, `pricing.ts`, `company.ts`, `progression.ts`. No se tocaron en esta fase.

## Riesgos detectados

1. **Familias de arte fijas en el código.** Toda la lógica asumía el GT-01; las demás carrocerías caían al vector.
   - **Mitigación:** contrato `VehicleArtFamily` y renderizador genérico (`ModularCar`).
2. **Configuraciones guardadas con la familia equivocada.** En 5C/5D un SUV podía guardar un registro del GT-01.
   - **Mitigación:** `configOf` lo muestra sobre la familia correcta conservando pintura, acabado e interior, y no reescribe la partida.
3. **Preview de la rama artística no verificado en navegador.**
   - **Mitigación:** se verificó con Playwright (`docs/phase6/modular-preview`).
4. **Tests que tomaban `models[0]` al azar.** Pasaron a fallar cuando ese modelo resultó ser un SUV de 1998.
   - **Mitigación:** ahora eligen un modelo de la familia correcta.

## Qué se puede reutilizar para Tuning Empire

| Pieza | Reutilización |
|---|---|
| Patrón de simulación determinista, constantes físicas y modelo de aceleración de `sim/engineering.ts` | Como referencia: el prototipo usa un motor propio (`src/tuning`) porque las piezas de preparación necesitan hardware explícito (turbo, inyectores, embrague) que `VehicleSpec` no modela. |
| Sistema de familias de arte (`sim/vehicleArt.ts`, `ModularCar`) | Directa: un auto de Tuning Empire puede tener una familia de arte y piezas visuales separadas de las mecánicas. |
| Componentes de UI y estilos Flow, i18n, `Scene` | Reutilizables para una UI definitiva. El prototipo usa una página aislada a propósito. |
| Infraestructura de pruebas (vitest y Playwright en `e2e/run.cjs`) | Directa: el prototipo ya tiene tests unitarios y un test e2e en la misma suite. |
| Guardado (IndexedDB, validación) | Reutilizable cuando el prototipo tenga progresión; hoy no guarda nada. |

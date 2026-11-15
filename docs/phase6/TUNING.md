# Tuning Empire — prototipo técnico (fase 6)

**EXPERIMENTAL.** Es un núcleo de simulación y una pantalla de laboratorio:
- No reemplaza Automotive Empire ni se conecta con su economía, sus partidas ni su progresión.
- Autos, motores y piezas son ficticios.

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/tuning/types.ts` | Contratos: vehículo, motor (curva de torque, corte, límite mecánico, inercia, inyectores), transmisión (relaciones, final, tracción, eficiencia, embrague, diferencial), neumático, calibración y entorno. |
| `src/tuning/parts.ts` | Catálogo de piezas como **cambios de hardware explícitos**, reglas de compatibilidad, montaje, ECU (validación de calibración) y Stages. |
| `src/tuning/engine.ts` | Torque a plena carga a partir del hardware y la calibración. Curvas de banco. |
| `src/tuning/drag.ts` | Simulación de drag determinista con paso fijo. Velocidad máxima. |
| `src/tuning/data.ts` | 3 autos ficticios (RWD turbo, AWD turbo con el mismo motor, FWD atmosférico), 24 piezas y 4 Stages. |
| `src/tuning/ui/*`, `tuning.html` | Laboratorio experimental (segunda página de Vite). |
| `tests/tuning-drag.test.ts` | 18 tests. |

## Piezas, compatibilidad y Stages

- **Las piezas cambian parámetros físicos:**
  - flujo de aire (desde cierto régimen);
  - mapa del turbo (presión máxima, régimen de presión plena, retraso);
  - eficiencia del intercooler;
  - caudal de inyectores;
  - capacidad del embrague;
  - relaciones de caja y relación final;
  - diferencial autoblocante;
  - neumático (μ, radio);
  - masa;
  - si la ECU se puede recalibrar.

  Ninguna pieza aplica un "+x % de potencia" universal.
- **Compatibilidad por:**
  - código de motor (bridas, ECU, inyectores);
  - aspiración;
  - plataforma (kits de peso);
  - patrón de campana de caja (embragues y cajas);
  - tracción (diferenciales);
  - rodado (neumáticos).

  Una pieza incompatible **no se instala** y el motivo queda informado.
- **La ECU de serie no acepta otro mapa.** Con reprogramación, rechaza:
  - presión mayor que la que da el turbo instalado;
  - corte por encima del límite de la distribución;
  - avance por encima del límite de detonación, que baja con más presión y con peor intercooler.
- **Un Stage** es un conjunto curado de piezas más una calibración **para un código de motor**.
  - Aplicarlo instala esas piezas y ese mapa, y valida todo.
  - Cada Stage es superconjunto del anterior: la diferencia está en el hardware, no en un multiplicador.

## Modelo físico y simplificaciones

**Torque a plena carga:**

`T(rpm, presión) = T_serie(rpm) × razón de presión × razón de densidad × flujo × avance`, limitado por inyectores.

- **Curva de serie:** contiene la eficiencia volumétrica del motor; todo cambio es relativo a ella.
- **Razón de presión:** `(1 + p) / (1 + p_serie(rpm))`, con el caudal de masa proporcional a la presión de admisión.
- **Temperatura de carga:** 300 K + 90 K por bar antes del intercooler, que quita la fracción `eficiencia`.
- **Avance:** ≈ 0,8 % de torque por grado.
- **Combustible:** BSFC 0,50 (atmosférico) / 0,60 (turbo) lb/hp·h, a 80 % de ciclo de inyector.
- **Turbo:** la presión sostenible crece con el régimen hasta el de presión plena. En carrera sigue al objetivo con un retraso de primer orden (τ = retraso del turbo).

**Carrera** (paso fijo de 1 ms, Euler semiimplícito):
- **Largada:** el embrague patina al régimen de largada hasta engranar.
- **Embrague:** limita el torque que transmite.
- **Fuerza en rueda:** `T × relación × final × eficiencia / radio`.
- **Tracción:** límite `μ × superficie × diferencial × carga del eje motriz`, con transferencia de peso `m·a·h/L`. Por encima del límite el piloto modula el acelerador y usa 0,97 del agarre; el tiempo que pasa así se informa como patinamiento.
- **Resistencias:** aerodinámica `½ρ·CdA·v²` y rodadura `Crr·m·g`.
- **Masa efectiva:** incluye la inercia del motor reflejada por la relación y la de las cuatro ruedas.
- **Cambios:** en el punto de cambio, sin fuerza durante el tiempo de cambio.
- **Mediciones:** tiempos en 60 ft, 1/8 y 1/4 de milla por interpolación. La trampa es la velocidad media en los últimos 66 ft, como la mide el cronometraje.

**No modelado** (lo dejo dicho, no oculto):
- curva de deslizamiento del neumático y temperatura;
- subida de vueltas durante el patinamiento;
- caída de presión durante el cambio;
- golpe en la transmisión;
- caballito;
- temperatura de pista;
- tiempo de reacción: los tiempos cuentan desde el primer movimiento.

## Validación

**Fórmula empírica de Hale/Huntington** para la velocidad de trampa: `mph ≈ 234 × (hp en rueda / lb)^(1/3)`. La literatura de drag la da con ±5–10 %, y sólo vale para autos que pueden aplicar su potencia.

| Configuración | Simulación | Fórmula | Diferencia |
|---|---|---|---|
| Atlas AWD de serie (sin límite de tracción) | 151 km/h | 146 km/h | +3 % |
| Kestrel Stage 3 + embrague + LSD + radiales de drag | 190 km/h | 184 km/h | +3 % |

Hay un test que exige estar dentro de 8 % en ambos casos. El tiempo del Kestrel de serie (15,6 s) es más lento que la fórmula (14,3 s) por límite de tracción, que la fórmula no considera.

**Lo que demuestran los tests** (`tests/tuning-drag.test.ts`):
- **Determinismo:** dos corridas iguales dan resultados idénticos.
- **Velocidad máxima:** sin aceleración indefinida, la velocidad se estabiliza en la máxima (el Atlas termina en el corte de quinta).
- **Masa:** +200 kg dan +0,4 s y menos velocidad de trampa.
- **Tracción:** la aceleración pico nunca supera μ·diferencial. Con menos agarre (superficie 0,6) la largada es más lenta. Con el mismo motor, el RWD sale peor que el AWD.
- **Relaciones:** la caja de relaciones cerradas y el final más corto cambian el resultado.
- **Más potencia no siempre es más rápido:**
  - Con embrague, diferencial y neumáticos de serie, el Stage 3 (+48 kW sobre el Stage 2) gana menos de 0,1 s porque el embrague patina.
  - El turbo grande da menos torque a 3500 rpm que el híbrido.
  - El Stage 1 queda limitado por los inyectores.
- **Incompatibilidades:** piezas y Stages incompatibles no se instalan, y la ECU rechaza mapas fuera del hardware.

## Pendiente

- Economía de taller, clientes, historia, tiendas y progresión.
- Animación de carrera, tiempo de reacción y árbol de largada.
- Modelo de neumático con curva de deslizamiento.
- Clima y altitud. El parámetro existe (`airDensity`); falta la interfaz.
- Mensajes de error del motor de simulación en otros idiomas: hoy están en español.

# Automotive Empire — dirección artística con Google Flow

**29 imágenes originales verificadas:** cuatro propuestas para cada una de siete pantallas y una iteración adicional del inicio. Selección del director artístico, disponible para revisión del usuario. Estas referencias no son todavía capas modulares ni una implementación React.

Descargar y extraer [Automotive-Empire-design-reference.zip](Automotive-Empire-design-reference.zip) en la raíz de un checkout. Abrir `design-assets/GALERIA.html`: permite ver las siete selecciones y desplegar todas las alternativas con su comparación de calidad, estilo, composición, legibilidad y facilidad en React.

## Selecciones

| Pantalla | Selección | Vista previa |
|---|---|---|
| Inicio | E, iteración del garaje fundador | [Inicio](preview-inicio.jpg) |
| Headquarters | A, campus isométrico | [Headquarters](preview-headquarters.jpg) |
| Taller | A, auto central y piezas abajo | [Taller](preview-taller.jpg) |
| Fábrica | A, cuatro estaciones laterales | [Fábrica](preview-fabrica.jpg) |
| Garaje | A, auto protagonista y colección | [Garaje](preview-garaje.jpg) |
| Cofres | B, estado de recompensa | [Cofres](preview-cofres.jpg) |
| Configuración | A, panel navy de audio | [Configuración](preview-configuracion.jpg) |

## Para Claude Code

Leer [IMPLEMENTACION.md](IMPLEMENTACION.md), [layout.json](layout.json), [COMPARACION.md](COMPARACION.md), [manifest.json](manifest.json) y [generation-log.json](generation-log.json). El ZIP conserva todos los originales, los prompts exactos y las huellas SHA-256. Usar esos archivos, no regenerarlos a partir de los prompts.

Los tamaños de JPEG son los registrados en el manifiesto. Las coordenadas, fuentes y colores del contrato son decisiones normativas para implementar en un lienzo 1920×1080, no una extracción automática exacta del bitmap. Falta producir fondos sin interfaz, autos aislados y piezas transparentes compatibles; después construir controles React y validar capturas contra las referencias. No utilizar rótulos, cifras ni datos ficticios del generador como estado del juego.

Flow mostró **0 créditos** con Nano Banana 2.1. Hubo bloqueos intermitentes por actividad inusual: el usuario intervino y se pasó a escritura y generación individual, esperando cada resultado. No se contrataron servicios ni se activaron opciones pagas. La publicación pública de este contenido fue autorizada expresamente por el usuario.

Rama de referencias basada en `phase5b-premium-2d-art-direction`, commit `0324f3bb8e1ebe051ed61177a4df205fd3151025`. Esta entrega añade arte y documentación; no cambia el código, la economía ni los guardados. No modificar main ni fusionar PRs para consumir estas referencias.


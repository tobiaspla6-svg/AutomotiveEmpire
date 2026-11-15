# Automotive Empire — contrato visual para Claude Code

La referencia es el archivo original elegido en cada pantalla. No regenerar imágenes a partir de los prompts para intentar copiarlas. Los prompts son trazabilidad, no sustituyen los archivos. Las selecciones son decisiones del director artístico; no representan aprobación posterior del usuario.

## Identidad

Videojuego de construcción de un imperio automotor. El mundo, los vehículos y las piezas son protagonistas. Ilustración 2D semirrealista de brochure automotriz: proporciones reales, contornos finos, volumen suave, ventanas y paneles definidos, llantas detalladas. Arquitectura cálida y materiales creíbles; iluminación marfil/dorada sobre estructuras azul tinta. Evitar tableros empresariales, gráficos KPI, tarjetas de métricas dominantes, neón y autos caricaturescos.

Colores normativos de implementación (los JPEG generados contienen variaciones): fondo #101923; superficie elevada #172630; marfil #EEECE5; texto secundario #ADB7B9; dorado #D8B16A; dorado hover #E6C682; verde #315B45; azul de carrocería #285A89; alerta #C96D58. El color nunca debe ser el único indicador del estado.

Tipografía normativa: Barlow Condensed 600/700 para títulos y acciones; Inter 400/500/600 para etiquetas, párrafos y números. Ambas familias ya figuran como dependencias de la rama phase5b-premium-2d-art-direction (package.json consultado). No se identificó una fuente real dentro de la imagen: la tipografía es una decisión para reproducir su carácter con texto vivo. Título de pantalla 56 px, título principal 92/112 px según línea, secciones 28 px, botones 24 px, cuerpo 18 px, metadatos 16 px. No usar texto funcional por debajo de 16 px a 1920×1080.

## Coordenadas y escala

Los rectángulos de `layout.json` son el contrato normativo del director artístico, en píxeles de un lienzo 1920×1080. No son una extracción automática exacta de las posiciones del JPEG. Los originales descargados se registran con sus dimensiones reales en `manifest.json`; no afirmar que Flow entregó 1920×1080 solo porque el prompt lo pidió.

Preservar proporción: `s = min(viewportWidth/1920, viewportHeight/1080)`. Centrar el lienzo y aplicar el mismo s a fondo y controles. No estirar el arte ni recortar ruedas para llenar la pantalla. Para comparar con el original completo usar `object-fit: contain`; si su relación difiere de 16:9 aparecerá un margen pequeño. En desktop reducido conservar botones de al menos 44 px en pantalla; pasar listas a scroll antes de achicar etiquetas. En móvil hace falta una adaptación aprobada: no se entregó una propuesta móvil generada.

## Interacción común

Botones: reposo dorado con texto tinta; hover más claro; pulsado desplazamiento vertical 1 px; foco visible marfil de 3 px separado 3 px; deshabilitado opacidad 0.45 y explicación accesible. Objetivo mínimo 44×44 px. Bordes 1–2 px, radios 4–8 px; evitar paneles de vidrio difuso. Transiciones 140–180 ms; respetar prefers-reduced-motion. Etiquetas en español con tildes reales. Teclado Tab/Enter/Espacio; Escape cierra un panel y devuelve el foco al disparador. No introducir atajos que reemplacen escritura o navegación del navegador.

## Inicio

Referencia seleccionada: `01-inicio/E-garaje-refinado.jpg`, derivada de la dirección D. Conservar composición de menú izquierdo y SUV verde derecho. La iteración corrigió la jerarquía del botón y eliminó el subtítulo inglés. El coche de E es algo más compacto y su sombra más dura que en la referencia original; en producción usar la calidad y proporciones del auto original, sin deformarlo para encajarlo en E.

Continuar carga la partida existente; si no existe, deshabilitarlo con explicación y hacer Nueva partida la acción principal. Nueva partida abre confirmación si reemplazaría una partida. Engranaje abre configuración. No incrustar acciones en el JPEG.

## Headquarters

Referencia seleccionada: `02-headquarters/A-campus.jpg`. El campus isométrico distingue taller, fábrica y garaje y permite interacción espacial. Ventanas cálidas, jardines contenidos y arquitectura art déco; el fondo no debe animarse como una cámara 3D.

Hotspots con nombre accesible e icono. Hover ilumina la silueta del edificio y muestra el nombre; selección navega a su pantalla. Recursos se obtienen del estado real, no de los números inventados por el generador. Reducir la barra inferior a destinos existentes: Sede, Taller, Fábrica, Garaje, Cofres. Los autos pequeños en perspectiva son parte del escenario; el catálogo y el editor usan perfil lateral estricto.

## Taller

Referencia seleccionada: `03-taller/A.jpg`. Auto grande central, categorías a la izquierda, inspector a la derecha y carrusel de piezas abajo. `03-taller/B.jpg` guía accesorios del SUV; D aporta dirección para interior, pero no se copiarán sus proporciones más caricaturescas ni el rótulo «Propuesta D».

Categorías: carrocería/body kit, ruedas, luces, manijas, pintura, techo e interior. Techo debe ofrecer fijo, descapotable, lona, rígido retráctil y solar; panel solar es una opción independiente sujeta a compatibilidad. Mostrar piezas compatibles con el modelo, no prometer que cualquier techo se monta en cualquier bastidor. Vista de interior independiente con asientos, volante, tablero, consola, materiales, tapizados y colores. Cambios visuales en vivo; guardar persiste un identificador de configuración y piezas, no una imagen aplanada.

Cada selección resalta borde y marca; no depender solo del dorado. Incluir deshacer, rehacer, restablecer con confirmación y estado de cambios sin guardar. El render debe mantener el mismo tamaño y puntos de montaje al cambiar una pieza.

## Fábrica

Referencia seleccionada: `04-fabrica/A.jpg`. Cuatro estaciones lateralmente ordenadas: bastidor, carrocería, pintura y montaje final. B tiene una miniatura incorrecta de pickup etiquetada fastback; C es demasiado taller artesanal; D corta vehículos en los extremos. A ofrece mejor legibilidad del flujo y menos dificultad para animar por capas.

Corregir rótulos ingleses, eliminar duplicaciones de etiquetas de estaciones y separar barras de progreso de la ilustración. Los tiempos y recursos son estado vivo. Iniciar valida capacidad, materiales y proyecto; si no alcanza stock, deshabilitar con motivo. Cola seleccionable, reordenable con controles de teclado y cancelable con explicación del recurso que se recupera. Brazos y chispas deben animarse en su estación; no soldar en la cabina de pintura.

## Garaje

Referencia seleccionada: `05-garaje/A.jpg`. El auto ocupa el espacio principal, la información queda a un lado y el catálogo abajo. B sirve como modo de colección de tres bahías; C cambia demasiado la familia SUV. No copiar nombres, años ni métricas inventadas del generador. Un mismo coche debe usar el mismo asset y configuración en taller, garaje y ficha. Personalizar abre el taller con el identificador del vehículo; seleccionar miniatura actualiza auto, nombre y datos. Las barras de prestaciones usan atributos del juego y una escala explícita. Volver restaura la selección y el scroll. Incluir estado vacío de colección y filtros que conserven foco.

## Cofres

Referencia principal: `06-cofres/B.jpg`, estado de recompensa. A aporta la caja cerrada; C aporta seis materiales/rareza. Unificar la geometría de caja entre cerrado y abierto: estas propuestas independientes no son fotogramas de una misma animación. D tiene buen mueble de piezas, pero deja el premio demasiado pequeño y compite con el cofre.

Estados: inventario, selección, apertura, revelación, reclamación y vacío. Abrir consume exactamente un cofre del inventario; deshabilitar durante la apertura para evitar doble consumo. Reclamar añade la pieza una sola vez y muestra resultado persistente; respetar recuperación de partida. Las seis rarezas deben tener nombre, símbolo y material, además de color; usar los nombres existentes del juego. El generador produjo palabras portuguesas y microtexto ficticio en A: sustituir por RUEDAS, FAROS, MOTOR, CERRAR y los nombres reales de rareza. No añadir compra, moneda premium, probabilidades ni economía nueva por interpretación de los dibujos. Permitir saltar animación y respetar movimiento reducido.

## Configuración

Usar como dirección principal el panel navy de `07-configuracion/A.jpg`: pocas opciones por pestaña, títulos grandes y acciones bien diferenciadas. B es una variante clara, pero se aparta más de las superficies del menú. Los valores 80/65/90 de la imagen son ejemplos, nunca valores obligatorios del juego.

Audio: maestro/música/efectos 0–100%, etiquetados y operables con flechas. Vídeo: pantalla completa, escala de interfaz y resolución cuando la plataforma lo permita. Juego: idioma y preferencias disponibles. Accesibilidad: tamaño de texto, alto contraste, subtítulos y movimiento reducido. No ofrecer un selector de resolución que el navegador no pueda aplicar. Aplicar confirma cambios y Volver conserva el estado anterior si no se aplicaron; al salir con cambios, diálogo Guardar/Descartar/Cancelar. Restaurar afecta solo preferencias y solicita confirmación, nunca borra la partida. Mantener contraste y tamaño mínimo del control al escalar la interfaz.

## Sistema modular de autos

Este paquete contiene referencias de pantalla aplanadas. Todavía no constituye una biblioteca de piezas transparentes intercambiables. No cortar cada pieza de estos JPEG y afirmar que ya encaja.

Por familia de carrocería definir lienzo maestro 1600×700, perfil lateral, eje X horizontal, ruedas sobre y=590. Puntos de montaje y dimensiones reales deben medirse sobre el primer asset aprobado de esa familia. Registrar: rueda delantera y trasera (cx, cy, radio), parachoques, faros, manijas, techo, umbrales, matrícula y límites de cabina. No inventar coordenadas universales para todos los modelos. Guardar unidad y versión de anclajes en el manifiesto de cada familia.

Capas: sombra, ruedas lejanas, chasis, ruedas cercanas, carrocería, pintura enmascarada, trim/body kit, puertas/manijas, ópticas, cristales, techo/accesorios y brillo. Interior tiene lienzo y anclajes propios. Pintura mediante máscara de carrocería, sin teñir vidrio, neumáticos u ópticas. Guardar `bodyFamilyId`, `anchorVersion`, ids de piezas, pintura/material y compatibilidades. Mantener neumáticos y llantas como componentes distintos. Al exportar sprites usar alfa real y evitar halos blancos.

## Pasaje a producción

Primero producir fondos limpios sin textos/HUD, vehículos aislados y piezas alineadas. Después construir controles vivos con React/CSS/SVG. Mientras eso no exista, un fondo completo con botones transparentes encima sirve solo como prototipo de navegación y no como personalización real. No mostrar números ni imágenes cambiantes dibujados en el fondo final.

Verificar contra el original descargado, no contra un prompt: captura de referencia y captura React al mismo tamaño, superposición al 50%, comprobar siluetas, espacios y orden de capas. Revisión a 1920×1080, 1440×900 y 1280×720; teclado, focos, estados vacíos y texto largo. No se ha ejecutado una implementación React con estos diseños, por lo que no hay una comparación pixel a pixel aprobada.

Trabajar en una rama independiente. No modificar main, fusionar PRs, reemplazar saves ni borrar arte existente. El paquete debe añadirse como referencias; no reemplaza ni aprueba automáticamente la lógica del juego.


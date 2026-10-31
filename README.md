# Exámenes Lab

**MVP 0.1** — Aplicación web local para separar exámenes, anotar regiones y crear recortes desidentificados listos para OCR. La interfaz está en español. **No ejecuta OCR todavía.**

## Funcionalidades incluidas

- Importar **PDF con varios exámenes** y convertir sus páginas a PNG (100–300 DPI).
- Marcar **comienzos de examen** entre páginas sin cambiar el PDF original.
- Rotar páginas en pasos de 90°; las coordenadas de las regiones existentes se transforman automáticamente.
- Dibujar, seleccionar, mover y redimensionar rectángulos etiquetados como **Respuesta, Subpregunta, Calificación docente, Observación docente y Privacidad**.
- Editar pregunta, inciso, orden de lectura, alcance de nota y valores docentes opcionales.
- Guardar páginas, límites y anotaciones en **SQLite**, persistentes entre sesiones.
- Previsualizar máscaras de privacidad en una página.
- Exportar ZIP **completo** (páginas desidentificadas + recortes) o **solo OCR** (recortes y JSON).
- Generar recortes **únicamente de regiones anotadas**; aplicar todas las máscaras de privacidad *antes* de recortarlas. Las regiones `privacidad` no generan recortes.
- Mantener original privado sin reemplazar; manifiesto sin nombre original del PDF ni legajo.

## Requisitos

- Python 3.11+ y Node.js 20+.
- No se necesita GPU, Docker, servicios externos ni cuentas de terceros.
- Red para la instalación inicial de dependencias npm/pip (y para las fuentes web opcionales de la UI).

## Inicio rápido

Abrí **dos terminales** en la carpeta del proyecto.

**Terminal 1 — API Python**

```bash
cd backend
python -m venv .venv
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# Linux / macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — React**

```bash
cd frontend
npm install
npm run dev
```

Ingresá a **http://127.0.0.1:5173**. El backend tiene documentación en http://127.0.0.1:8000/docs.

> **Importante:** usá exclusivamente `127.0.0.1` en el servidor backend: la API local todavía no tiene autenticación y permite consultar originales a través del visor de trabajo. No abrir el puerto 8000 hacia Internet ni hacia la red institucional.

## Flujo de uso

1. Subir un lote PDF. La aplicación genera las páginas de trabajo.
2. En la lista lateral, hacer clic en «Separar aquí» antes de la primera página de cada examen, dejando la primera página como inicio obligatorio.
3. Rotar las páginas que lo necesiten.
4. Elegir un tipo de región en la barra superior y arrastrar sobre la imagen. Asignar pregunta, inciso u orden desde el panel derecho. Usar **Privacidad** para las áreas que hay que ocultar, incluyendo legajos o nombres.
   Cada creación, movimiento, cambio de tamaño o propiedad se guarda automáticamente. Los selectores de pregunta (`P1`, `P2`, `P3`, `+`) e inciso (`a`, `b`, `c`, `+`) permiten agregar identificadores sin escribirlos. Una subpregunta dibujada dentro de una respuesta hereda su pregunta y queda por encima para poder seleccionarla. La herramienta elegida sigue activa para dibujar varios rectángulos consecutivos. Cada respuesta nueva propone la siguiente pregunta (`P1`, `P2`, `P3`…) dentro del examen; cada subpregunta propone el siguiente inciso (`a`, `b`, `c`…) dentro de su pregunta. Para añadir otro fragmento a un campo existente, elegí su pregunta o inciso en el selector: el orden del fragmento se calcula automáticamente. El orden se calcula por campo de cada examen, incluso entre páginas: los fragmentos de respuesta `P1` tienen una secuencia propia; los de `P1.a` y `P1.b` tienen secuencias separadas.
5. Abrir **Exportar**, previsualizar las páginas y revisar manualmente que **todos** los datos sensibles estén cubiertos. El botón de confirmación expresa que se verificó esto; la herramienta no detecta nombres automáticamente.
6. Generar y descargar el ZIP. El original queda fuera de él.

**Interpretación de las etiquetas:** `Subpregunta` se refiere a la *respuesta manuscrita* de un inciso, no al enunciado. Para una respuesta que ocupa varias regiones, asignar el mismo `question_id` (y el mismo inciso cuando corresponda) y definir un `reading_order` explícito. Calificaciones y observaciones docentes se exportan por separado.

La imagen ocupa el ancho disponible del visor y permite desplazamiento vertical. No hay encabezado sobre la imagen: la navegación, el zoom y las herramientas están en el panel derecho. El botón de documento activo permite ocultar o mostrar la columna izquierda. La previsualización anonimizada se muestra en el visor central, en modo de solo lectura. Si falla un autoguardado, se conserva el cambio local y aparece **Reintentar guardado**; la exportación permanece deshabilitada hasta guardarlo.

El manifiesto de exportación usa `schema_version: 4` y `orden_lectura_por: "campo"`. Incluye `preguntas`: grupos por `examen_id`, `pregunta_id`, `tipo` e `inciso_id`, con los identificadores de regiones ordenados por su secuencia de fragmentos. Las respuestas usan `tipo: "respuesta"` e `inciso_id: null`; las subpreguntas usan `tipo: "subpregunta"` y su inciso. Los consumidores del manifiesto deben usar esos cuatro campos para separar las secuencias. Se conserva también la lista completa `regiones`.

## Calificaciones docentes

Las calificaciones corresponden a una **pregunta** o un **inciso**; no hay nota total del examen. Al dibujar calificaciones consecutivas se proponen las siguientes preguntas (`P1`, `P2`…) o incisos (`a`, `b`…). Los contadores de notas son independientes de los fragmentos de respuestas.

Cada nota requiere **valor obtenido** y **denominador**, en campos separados. Se aceptan decimales con coma o punto y notas de cero; el denominador debe ser positivo y el valor no puede superarlo. Al crear una región se enfoca automáticamente el valor. En los siguientes exámenes del mismo lote, se propone el denominador ya usado para esa pregunta/inciso; la nota obtenida siempre comienza vacía. Podés modificar el denominador propuesto.

Se autoguardan también los borradores de notas incompletas. **Exportar** muestra cuáles faltan completar y permite abrir cada una. La API también impide generar paquetes con calificaciones incompletas o con alcance de examen. Cada pregunta con respuesta anotada debe tener una calificación completa antes de exportar; todos sus fragmentos comparten esa nota. Los incisos pueden usar una nota propia o la de su pregunta, sin inventar notas individuales. El botón **Marcar calificación** permite dibujar la nota para el campo pendiente.

La base existente se actualiza sin borrar anotaciones. Las fracciones antiguas inequívocas, como `7,5 / 10`, se convierten a números; se conserva el texto original. Las notas antiguas de examen deben asignarse manualmente a una pregunta/inciso. No se inventan denominadores para textos ambiguos.

En el manifiesto v4 cada calificación incluye `valor` y `denominador` numéricos, además de `valor_manual` para lectura humana. Cada campo en `preguntas` incluye `calificaciones`, con las regiones docentes de ese mismo examen y pregunta/inciso; esos IDs se mantienen separados del orden de fragmentos de estudiantes. `alcance_calificacion` indica si se usó una nota del inciso o la de la pregunta. No se ejecuta OCR.

## Revisión determinista de anotaciones

En **Revisar lote / Exportar** se comprueban las anotaciones del lote completo. No se ejecuta OCR ni se cambian etiquetas automáticamente.

- Bloquean la exportación: respuestas sin nota completa, calificaciones incompletas, órdenes repetidos o inválidos y regiones fuera de la página.
- Se señalan para revisión: recortes muy pequeños (lado menor inferior al máximo entre 12 píxeles y el 2 % del lado menor de la página), órdenes con saltos o que vuelven a páginas anteriores, saltos en incisos, regiones casi idénticas (intersección/unión ≥95 %), incisos que ocupan principalmente otra pregunta (≥80 % de cobertura), denominadores diferentes y notas sin respuesta marcada o con valores distintos para el mismo campo.
- Las advertencias pueden ser intencionales: una misma respuesta puede valer para varias preguntas, y una pregunta puede estar sin contestar. Se pueden confirmar como excepciones sin relabelar ni mover sus regiones.
- Se revisa el estado actual del lote; cualquier modificación de las anotaciones invalida la confirmación anterior. La API verifica la misma revisión al exportar. El manifiesto incluye `revision_anotaciones` como constancia de las advertencias confirmadas.

Los criterios geométricos son indicios, no una lectura de la respuesta ni del criterio del docente. El algoritmo no puede detectar por sí solo que un inciso manuscrito «e» se etiquetó «c».

Las correcciones docentes que están dentro de las respuestas se conservan en las imágenes. Su filtrado se resolverá en la etapa de OCR mediante preprocesamiento o instrucciones; no se intenta eliminarlas durante la anotación ni se señalan como errores de esta revisión.

## Almacenamiento

Por defecto `./data` en la raíz del proyecto (fuera del frontend). Se puede cambiar con `EXAMENES_DATA_DIR`:

```bash
# Linux/macOS
export EXAMENES_DATA_DIR=/ruta/privada/examenes
# PowerShell
$env:EXAMENES_DATA_DIR='C:\ruta\privada\examenes'
```

Estructura privada: `app.sqlite3`, `private/<lote>/original.pdf`, `private/<lote>/pages/*.png`, `exports/*.zip`. **No publiques ni subas estas carpetas al repositorio.**

## Estructura

```text
backend/app/db.py        SQLite y esquema
backend/app/main.py      Endpoints FastAPI y validación de reglas
backend/app/services.py  Rasterización, rotación, anonimización y ZIP
backend/tests/           Pruebas de integración
frontend/src/App.tsx     Flujo de trabajo y paneles
frontend/src/EditorCanvas.tsx  Editor visual Konva
frontend/src/api.ts      Cliente HTTP tipado
```

## Ejecutar pruebas

```bash
cd backend
pip install pytest httpx
python -m pytest tests -q
```

Pruebas de las reglas del editor (Node.js 24, sin dependencias adicionales):

```bash
node --test frontend/tests/*.test.mjs
```

Prueba de interacción en navegador (requiere las dependencias anteriores, Python con `playwright` instalado y Chromium en el sistema o `CHROMIUM_PATH`):

```bash
python frontend/tests/editor_browser.py
python frontend/tests/grading_browser.py
python frontend/tests/validation_browser.py
```

Este test inicia sus propios servidores en puertos libres y utiliza datos temporales. Comprueba selección de regiones cercanas, arrastre, los ocho tiradores, controles superpuestos, límites de página, zoom y scroll, herramientas persistentes y secuencias por inciso.

## Alcance actual y siguientes tareas

**MVP operativo, no versión institucional:** no hay autenticación, multiusuario, deshacer/rehacer, detector de PII, detección automática de notas, OCR ni revisor de texto. Se recomienda habilitar revisión por lote de *todas* las páginas antes de exportar contenido externo. La condición de privacidad es una confirmación humana, no una garantía automática de anonimización. Una nota escrita encima del texto del alumno sigue siendo visible dentro del recorte cuando se solapan; filtrado cromático pendiente de experimentación.

Los próximos hitos son: validación visual con lotes reales, undo/redo, navegabilidad de regiones de muchas páginas, revisión exhaustiva por lote, y luego adaptadores OCR (PaddleOCR / Unlimited-OCR) e interfaz de corrección de transcripciones.

**Seguridad:** solo para uso local en un equipo confiable. Si más adelante se habilita el acceso de docentes se deberá añadir autenticación, autorización por docente/materia, auditoría, cifrado/retención y revisión de privacidad antes del despliegue.

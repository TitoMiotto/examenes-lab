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
5. Abrir **Exportar**, previsualizar las páginas y revisar manualmente que **todos** los datos sensibles estén cubiertos. El botón de confirmación expresa que se verificó esto; la herramienta no detecta nombres automáticamente.
6. Generar y descargar el ZIP. El original queda fuera de él.

**Interpretación de las etiquetas:** `Subpregunta` se refiere a la *respuesta manuscrita* de un inciso, no al enunciado. Para una respuesta que ocupa varias regiones, asignar el mismo `question_id` (y el mismo inciso cuando corresponda) y definir un `reading_order` explícito. Calificaciones y observaciones docentes se exportan por separado.

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

## Alcance actual y siguientes tareas

**MVP operativo, no versión institucional:** no hay autenticación, multiusuario, deshacer/rehacer, detector de PII, detección automática de notas, OCR ni revisor de texto. Se recomienda habilitar revisión por lote de *todas* las páginas antes de exportar contenido externo. La condición de privacidad es una confirmación humana, no una garantía automática de anonimización. Una nota escrita encima del texto del alumno sigue siendo visible dentro del recorte cuando se solapan; filtrado cromático pendiente de experimentación.

Los próximos hitos son: validación visual con lotes reales, undo/redo, navegabilidad de regiones de muchas páginas, revisión exhaustiva por lote, y luego adaptadores OCR (PaddleOCR / Unlimited-OCR) e interfaz de corrección de transcripciones.

**Seguridad:** solo para uso local en un equipo confiable. Si más adelante se habilita el acceso de docentes se deberá añadir autenticación, autorización por docente/materia, auditoría, cifrado/retención y revisión de privacidad antes del despliegue.

# Propuesta de investigación y desarrollo

## Plataforma web unificada para preparación, anotación y desidentificación de exámenes universitarios

**Versión:** 2.0 — 31 de octubre de 2026  
**Estado:** propuesta técnica para evaluación y desarrollo  
**Idioma de trabajo:** español  
**Alcance inmediato:** transformar lotes de exámenes escaneados en páginas desidentificadas, recortes por región y metadatos estructurados, preparados para su posterior procesamiento mediante OCR/HTR.  
**Visión a futuro:** evolucionar la plataforma hacia una herramienta de asistencia a la corrección docente.

---

## 1. Resumen ejecutivo

Se propone desarrollar una **única aplicación web** que integre la importación de archivos PDF, separación de exámenes contenidos en un mismo documento, corrección de la orientación de las páginas, anotación visual de regiones, desidentificación y generación de insumos para OCR.

En lugar de utilizar Label Studio y conectar posteriormente varios scripts, la aplicación tendrá un **flujo de trabajo propio**, ajustado a la estructura de los exámenes universitarios y a los objetivos del proyecto de investigación.

El operador podrá seleccionar una región rectangular y asignarle una de cinco etiquetas:

1. **Respuesta**.
2. **Subpregunta**.
3. **Calificación docente**.
4. **Observación docente** (opcional).
5. **Privacidad**.

**Regla de negocio central:** las regiones no etiquetadas **no generarán recortes ni serán enviadas al OCR**. La única función de `Privacidad` es ocultar información sensible; estas regiones nunca se transcribirán.

Los documentos originales permanecerán inalterados y bajo custodia restringida. El sistema exportará **copias desidentificadas de las páginas**, **recortes de las regiones académicas** y un **manifiesto de metadatos** que preserve la relación lote → examen → página → región → pregunta/inciso. La transcripción OCR y la verificación humana se integrarán en fases posteriores; no forman parte del primer entregable funcional.

Esta arquitectura permitirá incorporar más adelante cuentas docentes, consignas, rúbricas y procesos de calificación sin sustituir la estructura de datos utilizada para registrar respuestas y notas.

## 2. Motivación y evidencia de la muestra

Se analizó un PDF de referencia de **18 páginas y tres exámenes** de *Sintaxis y Semántica de los Lenguajes* (Segunda Evaluación Parcial). La muestra aporta los siguientes requisitos concretos:

| Evidencia de la muestra | Implicación funcional |
|---|---|
| Páginas 1, 5 y 13: comienzan distintos exámenes, con una hoja de consignas impresa. | Incorporar divisores **entre páginas**, en vez de asumir un PDF por estudiante. |
| Páginas 4, 8, 10, 16 y 18: algunas hojas requieren rotación. | Permitir rotaciones de 90°, 180° y 270° por página sin modificar el original. |
| Páginas 3, 7–9 y 15–17: respuestas manuscritas distribuidas en varios sectores y con intervenciones docentes. | Permitir múltiples regiones por pregunta, en distintas posiciones y páginas, con orden lógico explícito. |
| Correcciones en rojo y respuestas generalmente en azul/negro. | Registrar **por separado** contenido del estudiante, nota y observaciones; estudiar una variante de imagen filtrada por color para OCR. |
| Páginas 2, 6 y 12: prácticamente vacías. | Las páginas se conservan como parte del examen, pero si no tienen anotaciones no generan recortes. |
| Presencia de grafos y autómatas. | Permanecen sin etiquetar cuando no interesan al estudio; no se necesita etiqueta «Excluido». |

Una página con exposición anómala no se considerará representativa para definir requisitos generales del OCR. El sistema no necesita interpretar grafos en su primera etapa.

Los límites indicados (después de la página 4 y de la 12) son **el ejemplo observado en esta muestra**: deberán poder modificarse en cualquier lote nuevo.

## 3. Objetivo y alcance

### Objetivo general

Desarrollar una aplicación web local que permita convertir lotes de exámenes escaneados en un conjunto auditable de imágenes desidentificadas, recortes clasificados y metadatos académicos listos para reconocimiento de escritura manuscrita en español.

### Objetivos específicos

- Importar un PDF que contenga varios exámenes consecutivos, renderizando todas sus páginas a imagen.
- Dividir el lote en exámenes individuales mediante límites definidos visualmente entre páginas.
- Rotar cada página y conservar una correspondencia estable de coordenadas con su imagen de trabajo.
- Anotar regiones rectangulares con las cinco etiquetas acordadas y los campos académicos correspondientes.
- Agrupar y ordenar fragmentos de respuestas, incluso cuando aparezcan en páginas distintas.
- Aplicar máscaras de privacidad **sobre copias nuevas**, sin reemplazar originales.
- Generar recortes únicamente de las regiones etiquetadas para contenido académico, a partir de páginas ya desidentificadas.
- Conservar las anotaciones editables y exportar JSON estructurado con rutas, dimensiones, coordenadas y vinculaciones.
- Habilitar una posterior integración de motores OCR/HTR y, en otra etapa, de flujos de corrección docente.

### Fuera del primer entregable

No se incluye inicialmente: ejecución de OCR, corrección automática con LLM, interpretación de grafos, detección automática de todas las zonas, un portal multiusuario docente, rúbricas, firma o publicación de calificaciones, ni reconstrucción del diseño original en las transcripciones.

**No se introducirán las etiquetas `Excluido` o `Pendiente`.** No dibujar una región equivale a no incluirla en el trabajo OCR. Se podrán conservar estados técnicos internos de un lote (por ejemplo, «en edición» y «exportado»), pero no serán etiquetas de contenido.

## 4. Flujo operativo de la aplicación

```text
PDF de un lote (original privado e inalterado)
      │
      ▼
[1] Importar y validar PDF
      │  → registrar fuente, hash SHA-256 y páginas
      ▼
[2] Convertir páginas a imágenes de trabajo
      │  → miniaturas + imagen de alta resolución
      ▼
[3] Marcar divisores entre exámenes
      │  → examen A, examen B, examen C...
      ▼
[4] Rotar páginas cuando corresponda
      │  → establecer orientación definitiva de anotación
      ▼
[5] Dibujar y editar regiones
      │  → Respuesta / Subpregunta / Calificación docente
      │     / Observación docente / Privacidad
      │  → vincular pregunta/inciso, orden y alcance de nota
      ▼
[6] Previsualizar privacidad y validar anotaciones
      │  → comprobar identificadores ocultos y vínculos
      ▼
[7] Generar derivados
      ├─ páginas desidentificadas
      ├─ recortes académicos desidentificados
      └─ JSON con regiones, relaciones y procedencia
      ▼
[8] Exportar paquete listo para OCR/HTR
      │
      └─ [Fase futura] OCR → revisión humana → dataset textual
```

### 4.1. Importación

- Cargar un PDF desde la interfaz; el sistema verifica que puede abrirse y controla tamaño y número de páginas.
- Conservar una copia del **PDF fuente** en un área privada, sin exponerlo en las exportaciones de investigación.
- Registrar identificador de lote, nombre original en un índice privado, cantidad de páginas y hash SHA-256.
- Generar miniaturas para navegación fluida e imágenes de trabajo de resolución configurable (valor inicial de prueba: **300 DPI**).
- La aplicación no envía el contenido a servicios externos durante esta fase.

### 4.2. Separación de exámenes

En una tira de miniaturas, el operador podrá insertar o retirar un **divisor entre dos páginas consecutivas**. Por defecto, el lote constituirá un examen hasta que se inserten divisores.

Ejemplo de la muestra:

```text
PDF de 18 páginas:

[1] [2] [3] [4]  ║  [5] [6] [7] [8] [9] [10] [11] [12]  ║  [13] [14] [15] [16] [17] [18]
  Examen EX_0001                Examen EX_0002                           Examen EX_0003
```

La partición será **lógica**, mediante rangos e identificadores. No es obligatorio recortar o alterar físicamente el PDF original. Cada página debe pertenecer a **un único examen**; las páginas vacías permanecen vinculadas al examen correspondiente.

### 4.3. Orientación de páginas

- Botones para rotar 90° a derecha/izquierda y 180°.
- Visualización inmediata del resultado; almacenamiento de la rotación como metadato.
- Las coordenadas de las regiones se guardan respecto de la **imagen canónica de trabajo ya orientada**, no de los píxeles escalados en pantalla.
- Si se rota una página después de anotarla, el sistema **transformará las cajas** al nuevo sistema de coordenadas, o exigirá confirmar una operación que las reubique, evitando desalineaciones silenciosas.
- Cada exportación reproducirá exactamente la misma orientación y geometría.

### 4.4. Herramienta visual de anotación

La vista principal contará con una imagen de página ampliable y desplazable; una barra de selección de etiqueta; un panel de propiedades de región; una lista de regiones de la página y un navegador del examen.

Operaciones requeridas: **dibujar, seleccionar, mover, redimensionar, eliminar, deshacer/rehacer, acercar/alejar y navegar**. Los rectángulos tendrán colores diferentes según la etiqueta, solo como ayuda visual. La aplicación guardará los cambios para permitir editar una sesión posteriormente.

La relación entre respuestas y preguntas **no será inferida de la posición visual**: se introducirá como dato estructurado al anotar. Una misma respuesta podrá contener varios recortes con números de orden diferentes, incluso en páginas distintas.

## 5. Semántica exacta de las cinco etiquetas

| Etiqueta | Qué representa | Campos asociados | Resultado |
|---|---|---|---|
| **Respuesta** | Texto manuscrito del estudiante correspondiente a una pregunta completa o fragmento general de ella. | `pregunta_id` **obligatorio**, `orden` obligatorio dentro de la pregunta. | Recorte para OCR de respuesta estudiantil. |
| **Subpregunta** | Texto manuscrito del estudiante que responde a un inciso particular. **No** es la impresión del enunciado. | `pregunta_id`, `inciso_id` y `orden` **obligatorios**. | Recorte para OCR vinculado al inciso. |
| **Calificación docente** | Puntaje, porcentaje u otra marca evaluativa escrita por el docente. | `alcance` obligatorio: examen/pregunta/inciso; identificador asociado si corresponde; `valor` y `escala` opcionales al anotar. | Recorte docente independiente; metadatos para vinculación con nota. |
| **Observación docente** | Comentario escrito por el docente; anotación **opcional**. | Alcance/relación opcionales; transcripción manual opcional. | Recorte docente independiente si se anota. |
| **Privacidad** | Nombre, apellido, legajo, firma u otro dato que no debe aparecer en el corpus derivado. | Geometría de la máscara y `region_id`; motivo opcional. | Ocultación irreversible en la **copia derivada**; **no genera recorte OCR**. |

**Decisión de modelado:** `Respuesta` y `Subpregunta` son dos **tipos de fragmento del estudiante**, no objetos incompatibles. Una respuesta de `P1` puede incluir una región general y otras para `P1.a`, `P1.b`, etc. La UI deberá permitir asignarlas al mismo árbol pregunta/inciso sin duplicar su texto.

Las consignas se registrarán una vez por **versión de examen**, en una fase posterior, si es necesario. En esta etapa basta con identificadores como `P1`, `P2`, `P3`, y `a`, `b`, `c` para incisos. No se exige seleccionar las consignas impresas con rectángulos.

### 5.1. Orden de lectura

- El orden lógico de cada región estudiantil se asigna explícitamente y puede reorganizarse desde una lista.
- Puede haber `P2` en la primera página y una continuación de `P1` en la segunda.
- El orden por coordenadas no debe alterar el `orden` definido manualmente.
- Las regiones de docente no se concatenan a las respuestas del estudiante.

### 5.2. Tratamiento de calificaciones

Una calificación puede corresponder al **examen completo**, a **una pregunta** o a **un inciso**. Al seleccionar `Calificación docente` se mostrará un campo de alcance; cuando el valor sea legible, el operador podrá introducirlo manualmente sin ejecutar OCR.

La app conservará tanto la **imagen de la nota** como la **transcripción opcional del valor**, para que el investigador pueda completarla o verificarla más adelante. No deducirá automáticamente notas finales sumando anotaciones rojas ni interpretará tildes/cruces como puntuaciones sin una regla declarada.

### 5.3. Observaciones y tinta docente superpuesta

Las observaciones docentes son opcionales y estarán separadas de la respuesta textual. Si un comentario del docente se superpone con la escritura del estudiante, **etiquetar ambas áreas no borra por sí mismo la tinta del docente**. Los recortes del alumno podrán conservar una versión de referencia y, más adelante, una variante filtrada por color (por ejemplo, para atenuar el rojo) sometida a revisión, sin asumir que el filtrado reconstruye trazos ocultos.

## 6. Reglas de negocio y prioridades

1. **Solo regiones etiquetadas**: no se exportarán recortes de contenido no marcado y no se enviará ninguna página completa al OCR como sustituto de esa regla.
2. **Privacidad prevalece**: toda máscara `Privacidad` se aplica a la página antes de generar cualquier recorte, incluso si se cruza con una región académica.
3. **Original inmutable**: el archivo fuente no se rota, recorta, sobrescribe ni modifica; todos los cambios se aplican a derivados.
4. **Examen único por página**: ninguna página puede pertenecer simultáneamente a dos exámenes.
5. **Referencias explícitas**: toda región `Respuesta` o `Subpregunta` pertenece a una pregunta; `Subpregunta` además tiene inciso.
6. **Orden explícito**: las respuestas compuestas se reconstruyen por el campo `orden`, no por lectura automática arriba-abajo.
7. **Autoría separada**: calificaciones y observaciones docentes no forman parte de los recortes identificados como texto estudiantil.
8. **Persistencia editable**: cambiar, eliminar o crear una región actualiza su registro; los archivos derivados se regeneran cuando corresponde.
9. **Exportación controlada**: debe haber una revisión visual de privacidad antes de habilitar la exportación académica; el sistema no puede garantizar por sí solo que una región sensible haya sido detectada si el operador no la etiquetó.
10. **Reproducibilidad**: cada paquete guarda un identificador de exportación, las transformaciones usadas y los hashes de sus insumos, para permitir regenerarlo.

Las etiquetas `Excluido` y `Pendiente` no existen. Una gráfica sin interés, un espacio vacío o cualquier contenido no señalado queda fuera de la exportación de recortes. Un lote aún en edición puede tener un estado **operativo**, pero ese estado no clasifica contenido de una imagen.

## 7. Desidentificación y conservación de fuentes

La interfaz permitirá marcar áreas sensibles como `Privacidad` mientras se anotan respuestas. El rectángulo solo almacena inicialmente una **instrucción de ocultamiento**: en el paso de exportación, un módulo Python generará una imagen nueva en la que la zona se reemplazará por píxeles opacos uniformes (por ejemplo, blanco o negro).

Se evitarán desenfoques, transparencias o capas desmontables, pues no eliminan necesariamente la información subyacente. Tras rasterizar y volver a codificar la copia como PNG/JPEG sin metadatos personales, la información oculta **no debe poder recuperarse desde ese archivo derivado**.

Se conservarán separadamente:

- **Original privado:** PDF del lote, intacto y de acceso restringido.
- **Índice privado de correspondencia:** referencia al original físico, legajo o identidad (si se conserva por autorización y necesidad del proyecto); **nunca se exporta** con el dataset.
- **Imagen de trabajo:** versión orientada que puede mostrar datos originales y exige controles de acceso.
- **Copia desidentificada:** imagen reescrita con las máscaras ya aplicadas.
- **Recorte académico:** fragmento **obtenido de la copia desidentificada**, no del PDF original.

La operación es mejor descrita como **desidentificación/seudonimización**, porque el índice privado permitirá eventualmente recuperar el original. Se requerirá una verificación humana antes de trasladar archivos a Kaggle o terceros, y se revisarán nombres de archivo y metadatos para evitar identificadores residuales.

## 8. Diseño de la interfaz web

### 8.1. Pantallas propuestas

| Pantalla | Función principal |
|---|---|
| **Lotes** | Importar PDF, acceder a lotes anteriores, ver cantidad de páginas/exámenes y estado operativo. |
| **Separador** | Tira de páginas con botones «Comienza un nuevo examen» entre hojas. |
| **Editor** | Visor con zoom/pan, rotación, dibujo de rectángulos, etiquetas, campos y orden. |
| **Revisión** | Recorrido por exámenes; previsualización con privacidad aplicada; verificación de regiones y vínculos. |
| **Exportación** | Crear derivadas; consultar resumen de páginas/recortes; descargar paquete ZIP o acceder a su carpeta local. |

### 8.2. Boceto funcional del editor

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Lote 003 | Examen EX_0002 | Página 3/8 | ↶ Rotar | ↷ Rotar | Exportar │
├─────────────────┬───────────────────────────────────┬───────────────────┤
│ Páginas         │                                   │ Región            │
│ [1] [2] [3]     │      IMAGEN ESCANEADA             │ Tipo: Respuesta   │
│ [4] [5] [6]     │                                   │ Pregunta: P2      │
│ [7] [8]         │      ┌────────────────────┐       │ Orden: 2          │
│                 │      │ región seleccionada │       │ [Guardar]         │
│ Etiquetas       │      └────────────────────┘       │                   │
│ □ Respuesta     │                                   │ Regiones          │
│ □ Subpregunta   │        zoom / desplazamiento      │ 1. P1 · orden 1   │
│ □ Calificación  │                                   │ 2. P2 · orden 2   │
│ □ Observación   │                                   │ 3. Privacidad     │
│ □ Privacidad    │                                   │                   │
└─────────────────┴───────────────────────────────────┴───────────────────┘
```

El dibujo usa coordenadas de la imagen (no coordenadas físicas del monitor). La selección puede superponerse a otras regiones; esto es necesario, por ejemplo, cuando la nota del profesor está escrita encima de una respuesta.

## 9. Arquitectura técnica propuesta

**Aplicación web de despliegue local inicial**: la interfaz se abre en un navegador, mientras que el servidor Python y los datos se alojan en la misma computadora. Esto evita enviar exámenes a un servidor externo durante la anotación y permite evolucionar luego hacia una instalación institucional.

| Capa | Tecnología recomendada | Responsabilidad |
|---|---|---|
| Frontend | **React + TypeScript + Vite + Tailwind CSS** | Gestión de lotes, navegación, formularios, revisión y exportación. |
| Editor de imágenes | **React Konva / Konva** | Dibujar, mover y redimensionar rectángulos con zoom y desplazamiento. |
| API | **Python + FastAPI** | Subida de PDF, reglas de negocio, almacenamiento de regiones y generación de derivados. |
| Renderizado de PDF | **PyMuPDF** | Extraer páginas, crear miniaturas e imágenes a 300 DPI sin GPU. |
| Procesamiento de imágenes | **Pillow + OpenCV** | Rotación consistente, máscaras permanentes, recortes y futuras variantes por color. |
| Persistencia | **SQLite** | Lotes, exámenes, páginas, regiones, relaciones, exportaciones y auditoría básica. |
| Almacenamiento | **Sistema de archivos privado** | PDF originales, imágenes de trabajo, copias desidentificadas y ZIP exportados. |
| OCR, en una siguiente fase | Adaptadores Python: **PP-OCRv6**, **PaddleOCR-VL-1.6** y **Unlimited-OCR** | Inferencia sobre los recortes exportados; ejecución local o en Kaggle. |

**Por qué FastAPI y no procesamiento íntegro en el navegador:** Python permite reutilizar bibliotecas de PDF/OCR/visión, manejar lotes grandes y compartir código de inferencia con Kaggle. **Por qué una interfaz web:** permite visualizar y editar regiones cómodamente y ofrece una evolución natural hacia acceso de docentes. Son elecciones propuestas, no dependencias obligatorias.

**Precaución de implementación:** se debe comprobar la licencia y las condiciones de redistribución de las dependencias elegidas, especialmente antes de distribuir la aplicación o desplegarla institucionalmente.

### 9.1. Módulos internos

```text
React UI
   │
   └── FastAPI
         ├── Ingesta de PDF
         ├── Gestión de lotes y separadores
         ├── Renderizado y orientación
         ├── Anotaciones y relaciones académicas
         ├── Desidentificación y recortes
         ├── Exportador (JSON + imágenes + ZIP)
         └── [posterior] Conector OCR / revisión / evaluación

SQLite  ← metadatos y relaciones
Archivos privados ← fuentes y derivados
```

La transformación para generar imágenes debe correr en segundo plano **dentro del proceso de la propia aplicación** cuando sea lenta, con estado visible y posibilidad de reanudar tareas. Esto no implica ejecutar trabajo del asistente de forma asíncrona: es un requisito de la aplicación que se construirá.

## 10. Modelo de datos inicial

| Entidad | Campos mínimos |
|---|---|
| `lote` | `id`, `fecha_importacion`, `archivo_original_privado`, `hash_sha256`, `total_paginas`. |
| `examen` | `id`, `lote_id`, `pagina_inicio`, `pagina_fin`, `identificador_anonimo`. |
| `pagina` | `id`, `lote_id`, `indice_original`, `examen_id`, `rotacion`, `ancho_px`, `alto_px`, `ruta_imagen_trabajo`. |
| `region` | `id`, `pagina_id`, `tipo`, `x1`, `y1`, `x2`, `y2`, `orden`, `metadatos`, `version_edicion`. |
| `pregunta` | `id`, `version_examen` (opcional), `codigo` (`P1`, `P2`, ...). |
| `region_pregunta` | `region_id`, `pregunta_id`, `inciso_id` (si corresponde); relación directa de la región estudiantil. |
| `calificacion` | `region_id`, `alcance`, `pregunta_id`/`inciso_id` opcionales, `valor` opcional, `escala` opcional. |
| `observacion_docente` | `region_id`, `alcance` opcional, `texto_manual` opcional. |
| `exportacion` | `id`, `lote_id`, `fecha`, `version`, `ruta`, `hash_manifiesto`. |

La identidad del alumno **no es un campo de esta base académica**. Si existe un vínculo con legajo/identidad, debe residir en un índice privado separado, con permisos específicos.

### 10.1. Coordenadas de recorte

Se guardan como enteros en **píxeles de la imagen canónica orientada**: `x1, y1, x2, y2`. Para dibujar en una miniatura, la interfaz aplica transformaciones de escala y desplazamiento; al guardar, las invierte. El backend valida que las coordenadas estén dentro de la página. Las rotaciones deben recalcular correctamente los límites.

Ejemplo de región de respuesta:

```json
{
  "region_id": "REG_0018",
  "examen_id": "EX_0002",
  "pagina_id": "PAG_0008",
  "tipo": "Respuesta",
  "pregunta_id": "P2",
  "orden": 2,
  "bbox_px": [145, 310, 1710, 880],
  "recorte": "recortes/EX_0002/REG_0018.png"
}
```

Los valores son ficticios y no corresponden a una transcripción real.

## 11. Formato de salida

La aplicación generará un paquete organizado, reutilizable por cualquier OCR que acepte imágenes:

```text
exportacion_LOTE_003/
├── manifest.json
├── examenes.json
├── paginas_desidentificadas/
│   ├── EX_0001_P001.png
│   ├── EX_0001_P002.png
│   ├── EX_0002_P001.png
│   └── ...
└── recortes/
    ├── estudiantes/
    │   ├── REG_0001.png
    │   ├── REG_0002.png
    │   └── ...
    └── docentes/
        ├── REG_0010_nota.png
        ├── REG_0011_observacion.png
        └── ...
```

Se podrán ofrecer dos modalidades: **paquete completo** para archivo y auditoría (incluye páginas desidentificadas y recortes), y **paquete mínimo para OCR** (solo los recortes autorizados y el JSON necesario). **Nunca** incluirá originales, índice privado, identificaciones o imágenes de trabajo sin ocultar.

Cada recorte conservará: identificador, fuente desidentificada, examen, página, etiqueta, pregunta/inciso si aplica, orden y coordenadas. Para las regiones docentes habrá un vínculo independiente con nota/observación. Para `Privacidad` se registrará la máscara en el manifiesto interno, pero **no se generará imagen de recorte**.

No se exportará texto inventado: en esta fase no hay OCR y, por tanto, los campos de transcripción estarán ausentes o nulos. La salida textual definitiva seguirá siendo **texto plano fiel en español**, sin intentar reproducir el diseño gráfico cuando se implemente la fase siguiente.

## 12. Integración posterior con OCR y uso de Kaggle

La aplicación no tiene que ejecutar OCR desde el primer día. Conviene que su **formato de exportación sea un contrato estable** que un notebook de Kaggle u otro proceso pueda consumir sin conocer el editor web.

Candidatos de investigación a evaluar posteriormente:

- **PP-OCRv6**, como línea base de bajo costo.
- **PaddleOCR-VL-1.6**, como alternativa multimodal.
- **Baidu Unlimited-OCR**, como alternativa documental de mayor tamaño.

El criterio de elección seguirá siendo la calidad sobre **respuestas universitarias manuscritas en español**, no la puntuación general de un benchmark de documentos. La comparación requerirá fragmentos revisados manualmente y métricas **CER**, **WER**, contaminación por marcas docentes, tiempo de revisión y consumo de VRAM. La arquitectura permitirá reemplazar los motores sin modificar las anotaciones.

Kaggle y sus dos T4 se reservarán para inferencia de los recortes desidentificados, sujeto a cuotas y condiciones vigentes. La aplicación local realizará importación, división, rotación, anotación y exportación en CPU, sin depender de esas GPU.

## 13. Plan de implementación

| Fase | Implementación | Entregable verificable |
|---|---|---|
| **MVP 1 — Ingesta** | Subir PDF, validar, generar miniaturas/imágenes y guardar el lote. | Un PDF con 18 páginas se visualiza completo; fuente original intacta. |
| **MVP 2 — Separación y orientación** | Insertar divisores y rotar páginas con persistencia. | La muestra queda dividida en tres exámenes; páginas invertidas se visualizan correctamente. |
| **MVP 3 — Etiquetado** | Editor de rectángulos, cinco etiquetas, propiedades, orden y edición. | Se registran regiones de una misma pregunta repartidas entre páginas; notas y respuestas independientes. |
| **MVP 4 — Privacidad y exportación** | Máscaras opacas, generación de copias nuevas y recortes, JSON y ZIP. | Ninguna imagen exportada contiene los identificadores marcados; solo existen recortes etiquetados. |
| **Validación del MVP** | Probar con los tres exámenes y más lotes representativos; verificar coordenadas, orden y archivos. | Exportación consistente y reproducible; revisión visual satisfactoria. |
| **Fase posterior — OCR** | Conectores para modelos, ejecución por lotes y resultados vinculados a regiones. | Texto bruto por recorte, sin romper el vínculo con pregunta o nota. |
| **Fase posterior — Revisión y dataset** | Corrección humana, reconstrucción de respuestas y exportación de datos. | Dataset textual fiel, vinculado a consignas y calificaciones. |
| **Evolución docente** | Autenticación, cursos, plantillas, rúbricas, asistencia a corrección y auditoría. | Plataforma de corrección institucional a diseñar y validar por separado. |

### 13.1. Pruebas de aceptación prioritarias

1. Al colocar divisores después de las páginas 4 y 12 de la muestra, se obtienen tres exámenes de 4, 8 y 6 páginas.
2. Una página girada 180° conserva regiones correctamente alineadas en pantalla, en base de datos y en exportación.
3. Dos fragmentos de `P1` en diferentes hojas se exportan con el mismo vínculo de pregunta y orden explícito.
4. Una región sin etiqueta no produce recorte.
5. Una región `Privacidad` produce ocultación en la copia derivada, **no** un recorte OCR, y no altera el PDF fuente.
6. Cuando una máscara de privacidad intersecta una `Respuesta`, su intersección también queda oculta en el recorte resultante.
7. Una región `Calificación docente` no se incluye dentro de la concatenación de texto de `Respuesta`/`Subpregunta`.
8. Tras cerrar y reabrir el editor, siguen presentes separadores, rotaciones, etiquetas y orden.
9. El ZIP y el manifiesto no revelan rutas privadas, legajos ni nombres reales de estudiantes.
10. Si se cambia una anotación y se vuelve a exportar, los derivados reflejan la versión actual sin sobrescribir los originales.

## 14. Seguridad, privacidad y riesgos

| Riesgo | Mitigación |
|---|---|
| Exposición accidental de legajos en la exportación. | Separar originales e índice privado, comprobar máscaras, volver a codificar imágenes y revisar manifiesto/nombres. |
| Ocultar con una capa reversible y no con píxeles. | Sustituir valores de píxeles en imágenes derivadas; no exportar capas removibles ni fuente privada. |
| Que una corrección del docente interfiera con la respuesta. | Etiquetas separadas, anotaciones superpuestas permitidas y eventual prueba de filtrado cromático. |
| Coordenadas erróneas por zoom o rotación. | Sistema de coordenadas canónico y pruebas de transformación con exportación visual. |
| Páginas del mismo PDF asignadas al estudiante incorrecto. | Divisores claros, navegación por examen y resumen antes de exportar. |
| Pérdida de anotaciones por cierre de navegador. | Guardado en SQLite durante la edición y revisión de cambios. |
| PDF malicioso o demasiado grande. | Validación de tipo y contenido, límites de tamaño/páginas, nombres generados, archivos fuera del directorio público; despliegue inicial local. |
| Hacer demasiado compleja la versión inicial. | Enfocar el MVP en preparación de imágenes y metadatos; posponer OCR y multiusuario. |
| Permitir múltiples profesores sin controles de acceso adecuados. | Autenticación, autorización, trazabilidad y políticas de privacidad como requisitos **previos** al despliegue institucional. |

Para una futura aplicación compartida se deberán analizar también políticas de conservación, permisos para usar exámenes con fines de investigación y manejo de datos personales de alumnos; el despliegue local no elimina estas obligaciones.

## 15. Proyección: de herramienta de investigación a asistencia docente

La principal ventaja de construir una aplicación propia es que el **modelo académico central** ya incorporará entidades para exámenes, preguntas, incisos, respuestas, calificaciones y observaciones. Esto es reutilizable en una plataforma donde el docente importe nuevos exámenes, revise respuestas y registre o confirme notas.

No obstante, la evolución requerirá módulos adicionales que **no forman parte del MVP**: usuarios y roles, materias/comisiones, versiones de consignas, rúbricas, flujo de asignación de evaluaciones, control de cambios, resolución de discrepancias, revisión humana de propuestas de IA, auditoría, retención y autorización de acceso. La corrección automática deberá presentarse como **asistencia** al docente, no como calificación definitiva sin validación.

El diseño actual debe evitar acoplar el OCR a la interfaz, y evitar mezclar la transcripción del alumno con las observaciones del profesor. De esa forma, la futura incorporación de modelos de IA no obligará a reconstruir el dataset ni a reinterpretar las anotaciones originales.

## 16. Decisiones propuestas para aprobación

1. **Desarrollar una única aplicación web propia** y retirar Label Studio de la arquitectura principal.
2. Utilizar **React/TypeScript + Tailwind + React Konva** para la interfaz y **FastAPI + PyMuPDF + Pillow/OpenCV + SQLite** para el backend local.
3. Definir los límites **entre páginas** para extraer exámenes lógicos desde un único PDF.
4. Usar exactamente las cinco etiquetas solicitadas, con sus campos de asociación y sin etiquetas `Excluido` ni `Pendiente`.
5. Aplicar la regla: **solo se preparan recortes de regiones académicas explícitamente etiquetadas**.
6. Mantener el PDF original intacto; exportar solo copias desidentificadas y recortes derivados de ellas.
7. Preservar la **nota docente** como entidad independiente desde el inicio, con transcripción numérica opcional durante el etiquetado.
8. Finalizar el primer MVP en la **exportación lista para OCR**; comparar modelos de reconocimiento y construir el dataset textual en la fase siguiente.
9. Diseñar los modelos de datos para una futura plataforma docente, pero **sin incorporar corrección automática ni multiusuario a la primera entrega**.

## 17. Resultado esperado

El proyecto entregará un editor web reproducible de exámenes escaneados, capaz de generar:

- Un corpus de **páginas desidentificadas** sin modificar las fuentes originales.
- Un conjunto de **recortes de respuestas, subpreguntas, calificaciones y observaciones**, debidamente clasificados.
- Metadatos de examen/página/pregunta/inciso, coordenadas, orden y procedencia.
- Un paquete portátil de imágenes y JSON listo para comparar diferentes OCR sobre escritura manuscrita en español.
- Una base de software reutilizable para futuros procesos de transcripción, análisis de calidad y asistencia a la corrección universitaria.

**Conclusión:** el mayor valor de esta primera versión no estará en ejecutar el OCR, sino en **producir datos de entrada consistentes, desidentificados y correctamente asociados a cada respuesta**, con una interfaz suficientemente sencilla para ampliar el corpus y con una arquitectura que admita nuevos módulos sin rehacer el trabajo de anotación.

---

## Referencias técnicas

- [PyMuPDF — renderizado de páginas PDF y rotación](https://pymupdf.readthedocs.io/en/latest/page.html).
- [PyMuPDF — recetas de imágenes y resolución DPI](https://pymupdf.readthedocs.io/en/latest/recipes-images.html).
- [Konva — edición de rectángulos con React y Transformer](https://konvajs.org/docs/react/Transformer.html).
- [FastAPI — documentación oficial](https://fastapi.tiangolo.com/).
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- [Baidu — Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR).
- [PaddleOCR — documentación](https://www.paddleocr.ai/).

> **Nota de alcance:** el informe se apoya en la inspección visual de la muestra entregada y en la documentación técnica citada. Las características del editor son requisitos propuestos, no funcionalidades ya implementadas. No se han ejecutado modelos OCR ni medido su precisión sobre la muestra.

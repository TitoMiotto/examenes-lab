# Conjunto preliminar OCR

transcripciones.json conserva las claves del manifiesto para asociar cada imagen y respuesta. transcripciones.md permite revisar las lecturas. Los recortes originales no se versionan. El campo imagen_local indica la ruta relativa esperada al montar las imágenes externas en imagenes/; cada nombre coincide con region_id. Las imágenes contienen marcas docentes que se excluyen deliberadamente del texto objetivo. No se incluyen las notas ni calificaciones del manifiesto.

Todos los registros están pendientes de revisión humana. Revisar las dudas y las fórmulas contra las imágenes, corregir la transcripción y solo entonces cambiar el estado a validado y validado_por_humano a true. No usar los marcadores [ilegible], [dudoso] e [inserción] como palabras esperadas del OCR: son anotaciones editoriales. Resolverlos o excluir esos fragmentos de las métricas. Acordar antes de medir una política para fórmulas, diagramas, saltos de línea y texto tachado. Las flechas y tuplas se han linealizado para lectura; no son objetivos exactos de reconocimiento de disposición visual. No se garantiza que todos los acentos y signos tenues estén resueltos.

El archivo adjunto manifest.json contiene muchas más regiones; este conjunto solo cubre las 25 regiones únicas recibidas en tres envíos. El manifiesto completo no se copia para evitar incorporar metadatos docentes innecesarios.

El segundo envío repitió las regiones f66aed48cab047ab8c92c5d03424321a y e6a74dc70dc541c6a7b483c57360d75d, que no se duplican. Cada región conserva su exportacion_id de origen; exportaciones_id enumera los manifiestos utilizados.

El tercer envío repitió 27a8554764d44c74a6eac98f36ff5c06 (no se duplica). Las regiones 69b556ddf53a4de5984ba5fe872e8a2e y 0defa2f26e894329aac46c4777a08acb son subrecortes de f462da6dcdcc482195f35c18666b91ef; el JSON registra solapamiento y grupo_contenido para no tratarlas como muestras independientes.

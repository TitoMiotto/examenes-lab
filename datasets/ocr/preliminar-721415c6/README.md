# Conjunto preliminar OCR

transcripciones.json conserva las claves del manifiesto para asociar cada imagen y respuesta. transcripciones.md permite revisar las lecturas. Los recortes originales no se versionan. El campo imagen_local indica la ruta relativa esperada al montar las imágenes externas en imagenes/; cada nombre coincide con region_id. Las imágenes contienen marcas docentes que se excluyen deliberadamente del texto objetivo. No se incluyen las notas ni calificaciones del manifiesto.

Todos los registros están pendientes de revisión humana. Revisar las dudas y las fórmulas contra las imágenes, corregir la transcripción y solo entonces cambiar el estado a validado y validado_por_humano a true. No usar los marcadores [ilegible], [dudoso] e [inserción] como palabras esperadas del OCR: son anotaciones editoriales. Resolverlos o excluir esos fragmentos de las métricas. Acordar antes de medir una política para fórmulas, diagramas, saltos de línea y texto tachado. Las flechas y tuplas se han linealizado para lectura; no son objetivos exactos de reconocimiento de disposición visual. No se garantiza que todos los acentos y signos tenues estén resueltos.

El archivo adjunto manifest.json contiene muchas más regiones; este conjunto solo cubre las seis imágenes recibidas. El manifiesto completo no se copia para evitar incorporar metadatos docentes innecesarios.

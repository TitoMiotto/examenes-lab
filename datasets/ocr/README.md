# Referencias preliminares para evaluación OCR

Hay **22 transcripciones de regiones únicas**, todas pendientes de validación humana. La meta inicial es al menos 30: faltan 8 regiones nuevas. No se versionan imágenes ni anotaciones docentes.

| Lote | Regiones | Estado |
| --- | ---: | --- |
| [721415c6](preliminar-721415c6/transcripciones.md) | 6 | Pendiente de revisión humana |
| [f6d73907](preliminar-f6d73907/transcripciones.md) | 16 | Pendiente de revisión humana |

Cada carpeta incluye JSON asociado a region_id del manifiesto, una versión legible y pautas de revisión. Los recortes originales deben mantenerse fuera de Git y asociarse por region_id. Los números cuentan regiones únicas, no exámenes ni respuestas completas. No convertir las lecturas preliminares en referencia validada sin revisar contra las imágenes; resolver o excluir marcadores editoriales antes de medir OCR.

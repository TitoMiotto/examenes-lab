# Referencias preliminares para evaluación OCR

Hay **31 transcripciones de regiones únicas**, todas pendientes de validación humana. Se alcanzó la meta de al menos 30 regiones. Dos de ellas son subrecortes de otra región incluida: la cuenta no equivale a 31 muestras independientes. No se versionan imágenes ni anotaciones docentes.

| Lote | Regiones | Estado |
| --- | ---: | --- |
| [721415c6](preliminar-721415c6/transcripciones.md) | 6 | Pendiente de revisión humana |
| [f6d73907](preliminar-f6d73907/transcripciones.md) | 25 | Pendiente de revisión humana |

Cada carpeta incluye JSON asociado a region_id del manifiesto, una versión legible y pautas de revisión. Los recortes originales deben mantenerse fuera de Git y asociarse por region_id. Los números cuentan regiones únicas, no exámenes ni respuestas completas. No convertir las lecturas preliminares en referencia validada sin revisar contra las imágenes; resolver o excluir marcadores editoriales antes de medir OCR.

Para dividir entrenamiento y evaluación, agrupar por lote_id_anonimo + examen_id y mantener juntas las regiones solapadas. No repartir un recorte y su región contenedora entre conjuntos distintos: produciría fuga de contenido. Las regiones solapadas están identificadas en el JSON.

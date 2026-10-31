# Decisiones de la primera implementación

- **Backend probado** con `TestClient` y con el PDF real de 18 páginas, renderizado a 100 DPI durante la prueba para reducir la carga temporal. El usuario podrá elegir 150, 200 o 300 DPI desde la interfaz.
- **Frontend implementado** con React, TypeScript, Tailwind CSS y React Konva. Los archivos TS/TSX superaron verificación sintáctica; falta ejecutar `npm install && npm run build` y una revisión interactiva en navegador (sin conexión a npm en el entorno de desarrollo actual).
- **Identidad y original:** no se exporta el PDF original, y el lote tiene un ID aleatorio; la recuperación del original es mediante ID de lote y número de página dentro del almacenamiento privado. Una tabla privada opcional de legajo/ubicación física por examen está pendiente y debe diseñarse con acceso restringido.
- **Persistencia:** se usa SQLite para edición. Los cambios de rotación preservan las regiones por transformación geométrica; no re-rasterizan el PDF fuente.
- **Aclaración de privacidad:** una marca `Privacidad` vuelve opacos los píxeles en el derivado, pero **no se detectan automáticamente** datos personales fuera de las máscaras. Antes de exportar se requiere que el operador marque individualmente las páginas como revisadas.
- **Formato:** las imágenes exportadas son PNG; el manifiesto guarda cada región, su clase, examen, página, coordenadas y atributos académicos. Para OCR, solo se crean recortes de regiones no `privacidad`.
- **Docente:** nota y observación no se fusionan con la respuesta del alumno, pero la tinta docente superpuesta a la respuesta no se elimina automáticamente.

## Pendientes priorizados

1. Instalar dependencias del frontend, compilar y ejecutar pruebas visuales del editor con un lote de prueba.
2. Implementar deshacer/rehacer, selección múltiple y mejoras de teclado/accesibilidad.
3. Incorporar revisión más exhaustiva de las regiones por todo el lote, incluyendo validaciones de orden y pregunta.
4. Agregar pruebas visuales de privacidad y geometría con rotaciones 90°, 180° y 270°.
5. Añadir un módulo de OCR desacoplado, con benchmarks sobre escritura manuscrita **en español**.


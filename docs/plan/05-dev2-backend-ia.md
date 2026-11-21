# 05 — Dev 2: PostgreSQL, backend, IA y PDF

**Responsable de todos los issues D2:** desarrollador 2. Dev 1 revisa contratos, interpretación y entregables integrados, sin reimplementar servicios.

**Estimación total:** 168 h individuales + 24 h compartidas = **192 h**. Disponibilidad adicional: 48 h de reserva durante seis semanas.

## 1. Issues listos para crear

Cada fila proporciona título, prioridad, sprint, duración, dependencias y entregable. Adjuntar al issue los criterios del mismo ID y la definición de cierre del [README](./README.md).

| ID | Título | Prioridad | Sprint | Duración | Dependencias | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| D2-01 | Auditar tabla, calidad, vectores e índices existentes en lectura | P0 | S1 | 12 h | Acceso autorizado a BD; no requiere I-01. | `docs/data-audit.md`, diccionario, mapeo territorial y lista de incógnitas verificables. |
| D2-02 | Comprobar Prisma y establecer acceso SQL seguro | P0 | S1 | 8 h | I-01, D2-01. | Spike de agregación/vector, parametrización, rol SELECT, pool y timeouts. |
| D2-03 | Implementar catálogo v1 desde categorías auditadas | P0 | S1 | 8 h | I-01, D2-01. | `/api/v1/catalog`, registro de indicadores y validadores comunes. |
| D2-04 | Implementar estadísticas, filtros y política de publicación comunes | P0 | S2 | 16 h | D2-02, D2-03. | Consultas reutilizables, reglas de nulos/denominadores y supresión. |
| D2-05 | Publicar endpoint de estadísticas y errores uniformes | P1 | S2 | 8 h | D2-04. | `/api/v1/statistics`, límites, metadatos y respuestas v1. |
| D2-06 | Verificar exactitud SQL y validación del endpoint | P0 | S2 | 4 h | D2-04, D2-05. | Fixture pequeña verificable y regresiones de cálculos/filtros/privacidad. |
| D2-07 | Implementar comparación reutilizando el servicio estadístico | P1 | S3 | 12 h | I-02, D2-04. | `/api/v1/compare`, diferencias y distribuciones consistentes. |
| D2-08 | Probar comparación, denominadores y supresión complementaria | P0 | S3 | 6 h | D2-07, D2-06. | Casos de referencia, cero, nulos y reconstrucción por resta. |
| D2-09 | Verificar consulta vectorial compatible y proveedor LLM por API | P0 | S3 | 10 h | D2-01, D2-02; credenciales/aprobación del proveedor. | Spike de búsqueda filtrada, modelo/revisión confirmados y adaptador API probado. |
| D2-10 | Crear herramientas SQL y orquestación del chat por API | P0 | S4 | 12 h | I-03, D2-07, D2-09. | Herramientas permitidas, `/api/v1/chat`, evidencia y límites de ejecución. |
| D2-11 | Integrar búsqueda semántica e híbrida sin recalcular embeddings | P1 | S4 | 8 h | D2-09, D2-04. | Herramienta semántica con filtros SQL, candidatos acotados y salida sanitizada. |
| D2-12 | Validar grounding, abstención y seguridad del chat | P0 | S4 | 8 h | D2-10, D2-11. | Hechos verificables, rechazo de cifras nuevas, pruebas IA y cierre del chat antiguo. |
| D2-13 | Construir snapshot único de reporte y narrativa respaldada | P0 | S5 | 8 h | I-04, D2-04, D2-07. | Documento interno con agregados, secciones, evidencia y advertencias. |
| D2-14 | Generar PDF del servidor con gráficos y límites | P1 | S5 | 14 h | D2-13, contrato/primer gráfico D1-14. | `/api/v1/reports/pdf`, ECharts SSR, plantilla fija y Chromium acotado. |
| D2-15 | Probar reporte, degradación IA y liberación de recursos | P0 | S5 | 6 h | D2-14. | Verificación de cifras/PDF, fallo proveedor, timeout y limpieza. |
| D2-16 | Configurar publicación mínima y controles de operación | P0 | S6 | 12 h | I-05; entorno disponible. | Contenedor/Node, HTTPS/gateway, secretos, rol lectura, health y release reproducible. |
| D2-17 | Medir consultas, carga y búsqueda antes de optimizar | P0 | S6 | 8 h | I-05, D2-16. | Resultados p95, planes SQL/vectoriales y optimización justificada solo si hace falta. |
| D2-18 | Resolver bloqueantes backend y entregar runbook/rollback | P0 | S6 | 8 h | D2-16, D2-17. | Correcciones, `docs/operations.md`, prueba de restauración/rollback y smoke test. |

## 2. Criterios de aceptación por issue

### Sprint 1 — 28 h + I-01

**D2-01**

- Evidencia real de total, tipos, nulabilidad, categorías, alias departamentales e índices; distinguir lo observado de lo supuesto.
- Registrar dimensión, distancia y procedencia conocida/desconocida del embedding; no leer ni exportar los 50,000 vectores para documentar.
- Entregar corte de columnas/categorías/mapeo antes del cierre del día 2.
- No modificar tabla, contrato ni registros para hacer coincidir supuestos.

**D2-02**

- Una agregación y una consulta de distancia funcionan con la ruta de datos elegida y valores parametrizados.
- Confirmar qué puede hacer Prisma 8 instalado sin cambios de esquema; fallback mínimo documentado si es necesario.
- Rol efectivo sin permisos de escritura/DDL y conexiones devueltas al pool después de éxito, error o timeout.
- Ningún reset, importación, regeneración masiva o ejecución automática de migraciones.

**D2-03**

- Catálogo refleja categorías y unidades auditadas, incluidos desconocidos; no contiene personas ni frecuencias sensibles.
- IDs coinciden con contratos/GeoJSON; validación de entrada rechaza campos no permitidos.
- Fixtures de Dev 1 y endpoint real tienen la misma forma.

### Sprint 2 — 28 h + I-02

**D2-04**

- Filtros AND/OR y rangos inclusivos se aplican en PostgreSQL.
- Conteos, promedios, medianas y denominadores concuerdan con cálculo manual/SQL de referencia.
- Aplicar nulos, calidad y supresión en una sola ruta compartida; no dejar escape por totales.
- Agrupación territorial conserva departamentos sin datos y no expone columnas arbitrarias.

**D2-05**

- Endpoint produce contrato, advertencias y `requestId`; no descarga filas al cliente.
- Casos vacíos dan 200; errores válidos usan envelope y HTTP acordados.
- Tamaño de cuerpo, timeout y cancelación funcionan en servidor, no solo en UI.

**D2-06**

- Fixture pequeña cubre ingresos 0, faltante, inválido y universo vacío; agrupaciones comprobables sin LLM.
- Una prueba combinada protege semántica AND/OR y exclusión financiera no invertida.
- Una regresión de cohorte pequeña demuestra supresión sin filtraciones por metadatos.

### Sprint 3 — 28 h + I-03

**D2-07**

- Entre 2 y 14 IDs únicos y referencia válida; selección territorial duplicada se rechaza.
- Diferencias se calculan en servidor sin redondeo prematuro.
- Reutiliza servicio de estadísticas y devuelve educación/ocupación/metas con categorías alineadas.

**D2-08**

- Cambiar referencia invierte diferencias como corresponde.
- Diferencias con valores vacíos/suprimidos son nulas.
- Totales/categorías no permiten reconstruir un pequeño grupo mediante resta en la respuesta.
- Resultado del comparador coincide con consultas estadísticas equivalentes.

**D2-09**

- Registrar modelo y revisión real, dimensión, preprocesamiento y distancia. Validar pregunta/documento con un ejemplo relevante.
- Filtros estructurados restringen candidatos en SQL; no se filtra solo un top-k global en memoria.
- Medir aproximación/recall bajo filtro selectivo frente a referencia exacta pequeña/autorizada.
- Proveedor aprobado: acceso API, modelo, cuotas, costos, política de datos y adaptación al SDK instalado comprobados.
- Un vector incompatible no se presenta como búsqueda válida; si no puede resolverse sin regenerar, declarar bloqueo de I-03.

### Sprint 4 — 28 h + I-04

**D2-10**

- Herramientas de estadísticas y comparación tienen argumentos validados y SQL predeterminado.
- LLM por API sin conexión a BD; no existe herramienta de SQL arbitrario.
- Presupuesto global, máximo de herramientas y salida JSON validados.
- Evidencias tienen filtros, versión y hechos; historial del cliente no puede convertirse en evidencia.

**D2-11**

- Solo se genera embedding de la pregunta; vectores almacenados se reutilizan intactos.
- Herramienta híbrida respeta filtros, proyección de campos, top-k y timeout.
- Evidencia semántica es exploratoria, no una prevalencia ni un conteo de todas las personas con esa intención.
- Sanitización evita enviar perfiles completos o contenido sensible al proveedor.

**D2-12**

- Cifras en texto, tablas y gráficos se derivan de hechos autorizados; cifras inventadas provocan reintento acotado o fallback.
- Casos económicos exactos, pregunta ambigua, sin evidencia y causalidad no soportada están cubiertos.
- Inyecciones en pregunta, historial o registro recuperado no cambian permisos/herramientas.
- `/api/chat` anterior se retira o delega al mismo servicio protegido, sin bypass local.
- Proveedor caído no produce una respuesta inventada; tabla verificada o error explícito.

### Sprint 5 — 28 h + I-05

**D2-13**

- Obtener agregados relacionados en una transacción de solo lectura con snapshot consistente, o demostrar equivalencia si el corte es inmutable.
- Liberar transacción/conexión **antes** de llamar al LLM o renderizar.
- Narrativa, gráficos y cifras usan el mismo objeto interno, sin aceptar números calculados por navegador.
- Secciones/filtros solicitados presentes; fuentes y limitaciones siempre incluidas.

**D2-14**

- PDF con fuente tipográfica que cubre español, tablas, gráficos SVG y páginas bien cortadas.
- Plantilla fija con escape de texto; render sin acceso a red/archivos no autorizados ni URLs suministradas por usuario.
- Chromium y recursos necesarios están incluidos en el entorno reproducible.
- Concurrencia 1, límites de páginas/tamaño/tiempo y limpieza en `finally`.
- Generar buffer completo antes de responder 200; no persistir informes ni crear cola.

**D2-15**

- Cifras extraídas/contrastadas del PDF coinciden con el snapshot esperado y sus filtros.
- Caída de narrativa produce PDF estadístico con aviso; fallo de datos/render produce error JSON.
- Error o timeout cierra página/proceso y no deja conexión abierta ni archivo sensible temporal.
- No imágenes o fuentes remotas ni contenido arbitrario de usuario en el render.

### Sprint 6 — 28 h + I-06

**D2-16**

- Entorno candidato usa la misma BD/corte autorizado, con rol lectura y puerto no público.
- HTTPS, control de acceso del piloto, rate limit, secretos y health funcionando.
- Build no ejecuta importación, migraciones ni descarga inesperada de modelos al primer usuario.
- Logs estructurados sin credenciales/prompts sensibles y error correlacionable por `requestId`.

**D2-17**

- Medición reproducible con tamaño de muestra/concurrencia/entorno y p50/p95 registrados.
- Inventario de índices primero; no crear índice sin evidencia del cuello de botella.
- Prueba bajo filtros selectivos, comparación de 14 departamentos y concurrencia chat/PDF.
- Cualquier DDL requiere aprobación explícita, validación posterior y reversión documentada.

**D2-18**

- Runbook cubre despliegue, variables, límites, revisión de logs, proveedor caído y reinicio seguro.
- Rollback de aplicación ensayado sin tocar tabla/vectores; restauración de backup verificada en entorno aislado autorizado.
- Bloqueantes resueltos; smoke tests de datos, chat y PDF en URL final junto con Dev 1.

## 3. Checklist de seguimiento

Marcar cada ID solo al cerrar su issue; añadir `— PR: …; evidencia: …`.

- [ ] D2-01 — Auditoría.
- [ ] D2-02 — Acceso y compatibilidad Prisma.
- [ ] D2-03 — Catálogo.
- [ ] D2-04 — Consultas y privacidad.
- [ ] D2-05 — Endpoint estadísticas.
- [ ] D2-06 — Pruebas SQL/API.
- [ ] D2-07 — Endpoint comparador.
- [ ] D2-08 — Pruebas comparación/privacidad.
- [ ] D2-09 — Spike vectores/proveedor.
- [ ] D2-10 — Herramientas y chat API.
- [ ] D2-11 — Búsqueda semántica/híbrida.
- [ ] D2-12 — Grounding y seguridad IA.
- [ ] D2-13 — Snapshot de reporte.
- [ ] D2-14 — PDF del servidor.
- [ ] D2-15 — Pruebas de PDF.
- [ ] D2-16 — Despliegue y controles.
- [ ] D2-17 — Rendimiento y planes.
- [ ] D2-18 — Correcciones y runbook.

Los hitos I-01…I-06 se actualizan en el [README](./README.md), sin sumar su esfuerzo otra vez.

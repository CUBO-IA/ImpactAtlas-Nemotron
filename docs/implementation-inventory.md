# Inventario de implementación y pendientes

**Corte:** 2026-11-22. Inventario documental del repositorio y del estado local observado; no constituye aceptación de release.

## Cómo leer este documento

- **Implementado (código):** hay código identificable en el checkout. No implica que se haya probado contra el entorno final.
- **Parcial / no cerrado:** existe implementación o evidencia acotada, pero faltan criterios del issue o integración.
- **Pendiente / bloqueado:** no se encontró evidencia de implementación/verificación suficiente, o hay una dependencia explícita.
- **Verificación previa:** afirmación registrada en la planificación antes de la auditoría o del avance actual; no presentarla como evidencia del estado actual.
- **Evidencia conocida:** referencia a código, documento o resultado ya registrado. En esta tarea no se ejecutaron pruebas, no se accedió a bases de datos ni a staging.

Los checkboxes de `docs/plan/` son seguimiento del plan, no una certificación global. La documentación de operación declara expresamente que el despliegue no está preparado ni publicado.

## Resumen ejecutivo

Hay una aplicación Next.js con pantallas de exploración, comparación, chat y reportes; endpoints backend para catálogo, estadísticas, comparación, chat y health; servicios de datos con validación, reglas de privacidad, proveedor LFM3 local y ruta semántica con compuerta desactivada por defecto; y generación de PDF de servidor. Varias partes tienen pruebas locales registradas en el plan o cambios recientes, pero **no están cerrados los hitos globales I-01…I-06**, no hay evidencia E2E contra un candidato desplegado y no se debe afirmar que el chat actual esté resuelto.

| Área | Estado global | Evidencia / principal límite |
| --- | --- | --- |
| Auditoría de datos | Auditoría local documentada | `docs/data-audit.md`; solo aplica a la instancia local observada. No prueba el entorno de despliegue. |
| Explorador | Implementado parcialmente | Página, estadísticas y mapa MapLibre con GeoJSON local (14 IDs verificados, sin tiles); falta licencia de geometrías y evidencia en candidato. |
| Comparador | Implementado en UI/API | Pantalla, selector, tabla y endpoint; aceptación cruzada real y evidencia E2E no cerradas. |
| Chat LFM3 local | Implementación presente, integración/aceptación no resueltas | Proveedor y orquestador existen; disponibilidad del modelo, grounding completo y comportamiento actual no validados. |
| Búsqueda semántica | Desactivada por defecto; compatibilidad bloqueada | Requiere dos variables explícitas; auditoría no confirmó procedencia ni relevancia de embeddings. |
| PDF | Descarga y generación presentes; cierre parcial | Hay reporte de descarga local y cambios recientes para ChartSpec/paginación; faltan criterios y legibilidad final. |
| Operación / release | Pendiente | No hay despliegue de aplicación, HTTPS/acceso, rate limit ni backup/rollback ensayados documentados. |

## Estado funcional

### Explorador y visualización territorial

**Implementado en código**

- Rutas de exploración bajo `app/explorador/page.tsx`; shell, filtros/contexto compartido y estado de URL descritos en `docs/plan/04-dev1-frontend.md`.
- Panel de estadísticas (`components/statistics/detail-panel.tsx`) y tabla alternativa (`components/map/department-table.tsx`).
- `components/map/sv-choropleth-map.tsx` dibuja las 14 geometrías con MapLibre desde `/geo/sv-departamentos.geojson`, sin proveedor de tiles; selector de indicador, leyenda y tabla accesible como alternativa.
- API y lógica de estadísticas: `app/api/statistics/route.ts`, `src/server/statistics.ts`, `src/db/queries/statistics.ts`.

**Parcial / no verificado**

- El mapa usa MapLibre 6.19 con el GeoJSON local como `source` y un estilo sin tiles ni servicios externos (`components/map/sv-choropleth-map.tsx`). La selección por mapa y la tabla accesible son equivalentes. D1-04 sigue sin cerrar en el plan porque la licencia de las geometrías no está declarada en el GeoJSON.
- Existe `public/geo/sv-departamentos.geojson` (`FeatureCollection` de 14 features). Verificado localmente: sus `properties.departmentId` coinciden con los 14 IDs de `src/data/audited-catalog.json` y declaran `source: "Centro Nacional de Registros (CNR), El Salvador"`; **no declaran licencia**. MapLibre consume el archivo directamente. `docs/data-audit.md` ya refleja este hallazgo.
- `docs/plan/04-dev1-frontend.md` registra D1-05 y D1-06 como completados con referencias a código/pruebas locales; no se verificó aquí la ejecución actual ni el endpoint de un candidato.

### Comparador

**Implementado en código:** ruta `app/comparador/page.tsx`; componentes en `components/compare/`; endpoint `app/api/compare/route.ts`; servicio `src/server/comparison.ts`.

El plan registra D1-07…D1-09 como completados (selector de departamentos, referencia dinámica, brechas en USD/puntos porcentuales y pruebas de fase 3). Esto es evidencia local consignada, no aprobación del hito I-03: no hay prueba de integración/release en esta tarea y la compatibilidad semántica y la disponibilidad real del LFM3 continúan bloqueando la aceptación integral.

### Chat y modelo local LFM3

**Implementación presente:** interfaz bajo `app/chat/` y `components/chat/`; endpoint `app/api/chat/route.ts`; orquestación `src/server/chat.ts`; runtime acotado `src/server/chat-runtime.ts`; proveedor local `src/ai/provider.ts`; bloques y gráficos respaldados por contratos. El orquestador vivo (`buildBlocks`) ahora emite bloques `chart` con los mismos hechos SQL publicables de la tabla, agrupados por unidad (hasta dos paneles, máx. 30 categorías); el renderer correspondiente es `components/chat/chart-renderer.tsx` y el formateador compartido `src/charts/chart-spec.ts`. `src/ai/chat-service.ts` es un productor antiguo no importado por la app.

**Estado: no declarar el chat actual como resuelto en general.** El plan registra D1-10…D1-12 como completados con evidencia local anterior, pero la ruta y los cambios locales requieren revisión e integración. Una consulta local sobre Santa Ana respondió HTTP 200 con evidencia; la pregunta reportada sobre capacitación solar también respondió HTTP 200 con abstención, pues la muestra no identifica sedes. Esta última respuesta evita inventar lugares, pero no identifica la causa general del 503 ni demuestra que todas las consultas funcionen.

El proveedor está diseñado para LFM3 local vía `@browser-ai/transformers-js`, CPU q4 y `LFM3_MODEL_DIR` (por defecto `models`), sin API remota según la decisión documentada. Una consulta local se completó con evidencia; esto no verifica disponibilidad ni recursos suficientes en un entorno candidato.

La ruta de chat documenta el control de acceso del piloto en gateway/proxy, no en el handler. HTTPS, autenticación del piloto y limitación efectiva no están configurados/versionados en el repositorio, según `docs/operations.md`.

### PDF y gráficos

**Implementación presente:** formulario/descarga en `components/reports/report-configurator.tsx`; API y render en `src/server/report-http.ts` y `src/server/reports.ts`; snapshot/narrativa en `src/server/report-snapshot.ts` y `src/server/report-narrative.ts`; render con Chromium mediante Playwright y ECharts SSR.

**Evidencia parcial:** el plan de frontend registra que `src/contracts/fase5.test.mjs` pasó 3/3 con servidor local, se descargó un PDF desde la interfaz y una fixture sintética de 20 categorías comprobó continuación de tablas, nulos y supresión tras corregir el recorte. D1-14 y D1-15 siguen sin cerrar: falta verificar legibilidad de gráficos mixtos y el resto de criterios. Este inventario no repitió esas verificaciones.

**Cambios locales observados:** `src/server/reports.ts` pasó a construir gráficos desde `ChartSpec`, compartir `formatChartValue`, separar hasta dos unidades en paneles y rechazar más de dos, paginar tablas en bloques de diez filas y calcular páginas esperadas. `components/reports/report-configurator.tsx` difiere la revocación del object URL y añade `aria-pressed`. Son cambios sin commit y no verificados en esta tarea; no equivalen a cierre de D1-14/D1-15 o D2-15.

El requisito de 20 páginas/10 MiB y la seguridad del render (plantilla fija, escapes, sin recursos externos arbitrarios) están descritos en el plan/runbook. No se verificaron contra despliegue. D1-17 (regresión E2E) permanece pendiente.

## Datos, semántica y límites analíticos

### Auditoría previa frente a requisitos no verificados

`docs/plan/01-arquitectura-y-datos.md` empezó como planificación basada en inspección de archivos; su texto de “50,000 registros declarados” era **verificación previa pendiente**, no prueba. La auditoría posterior en `docs/data-audit.md` sí registra una inspección de la instancia PostgreSQL local, con consultas agregadas/metadatos en transacción `REPEATABLE READ READ ONLY`.

La auditoría local consigna:

- 50,000 filas e IDs distintos; tabla `public."NemotronSvMuestra"` con 10 columnas `NOT NULL`.
- 14 nombres departamentales; dominios observados de educación/sexo; catálogo local en `src/data/audited-catalog.json`.
- Extensión `vector` 0.8.7 y 50,000 embeddings de dimensión 768 con normas agregadas cercanas a 1.
- Índice observado: solo la PK B-tree; no hay índice vectorial declarado en esa tabla.
- Verificaciones registradas con consultas de producción: grupos departamentales suman 50,000, educación produce 7 grupos, `educationIds=["tecnico"]` selecciona 9,387, `__missing__` devuelve cero y el snapshot produjo 7 categorías educativas, 15 ocupaciones y 8 metas.

Todo lo anterior **se limita a la instancia local auditada**. No confirma datos, permisos o esquema del entorno de despliegue. La unidad temporal/fuente del ingreso y la procedencia/revisión/preprocesamiento de embeddings no se establecieron. No se midieron planes con `EXPLAIN ANALYZE`.

### `DATA_CATALOG_PATH`

`docs/data-audit.md` recomienda fijar explícitamente `DATA_CATALOG_PATH` para cada entorno/corte; `.env.example` local documenta `./src/data/audited-catalog.json` como ejemplo. En este entorno se configuró esa ruta en `.env` (ignorado por Git) y el catálogo y las estadísticas respondieron HTTP 200. Esto no constituye configuración de producción: no asumir el catálogo por `DATABASE_URL` ni reutilizar categorías entre entornos sin auditarlas.

### Semántica

Hay búsqueda en `src/ai/semantic.ts` y `src/db/queries/semantic.ts`, pero `semanticSearchEnabled` exige simultáneamente `SEMANTIC_SEARCH_ENABLED=true` y `SEMANTIC_SEARCH_AUDIT=confirmed`; de otro modo se abstiene. La consulta valida vector finito de 768 dimensiones, restringe por filtros SQL y usa k mínimo de publicación 5. Estos controles de forma/privacidad **no prueban compatibilidad semántica**.

La auditoría no identificó modelo/revisión/pooling/prefijo de vectores almacenados ni hizo evaluación de relevancia. Por tanto, la semántica debe permanecer apagada hasta validar procedencia y resultados con criterios revisados. Igual dimensión y normalización no bastan. No regenerar ni alterar vectores para ocultar este bloqueo.

## Operación, seguridad y despliegue

`docs/operations.md` es un runbook de preparación, **no evidencia de entorno publicado**. Consigna que:

- Compose solo define PostgreSQL local; no hay servicio de aplicación/despliegue, gateway HTTPS, autenticación del piloto, rate limit, monitorización de aplicación o copias automáticas configuradas.
- El rol usado en la auditoría local tenía `INSERT`, `UPDATE` y `DELETE`; las transacciones read-only de auditoría no corrigen sus permisos permanentes. No se verificó rol de aplicación solo lectura en entorno candidato.
- No se registraron mediciones p50/p95, carga o planes; no se ensayaron rollback de aplicación/restauración de backup.
- Sin autorización y evidencia del entorno, no hacer release, migraciones, importaciones, DDL, restauraciones ni carga contra BD compartida/producción.

El código contiene límites de runtime en chat y rutas de backend, pero límites declarados no demuestran rate limiting, control de acceso o cancelación efectivos en infraestructura. Health de aplicación y correlación/logging operativos tampoco se verificaron en un candidato. El checklist de cierre de `docs/operations.md` permanece pendiente.

## Pendientes y bloqueos principales

1. Cerrado el trabajo local sin commit: `7fe3722` agrupa los cambios de chat, PDF, mapa, operación y documentación. Falta la reconciliación con criterios D1/D2 contra un candidato desplegado.
2. No marcar el chat como resuelto hasta verificar preguntas respaldadas, ambigüedad/abstención, fallos de modelo, seguridad y bypass del flujo anterior.
3. Mantener búsqueda semántica desactivada hasta documentar procedencia y validar relevancia/compatibilidad de embeddings.
4. GeoJSON: fuente y correspondencia de 14 features verificadas; MapLibre ya consume el archivo sin tiles y la coropleta/selección están verificadas en navegador. Falta declarar/validar la licencia de las geometrías para cerrar D1-04.
5. Cerrar PDF compartido/legibilidad, límites y pruebas restantes; completar regresión E2E.
6. Elegir y autorizar entorno, asegurar secretos, rol SELECT efectivo, HTTPS/acceso/rate limit, modelo local y runtime PDF; ensayar health, rollback y restauración de forma aislada.
7. Verificar contra el entorno autorizado sin exponer secretos, filas, prompts personales o embeddings; documentar versión/corte y evidencia no sensible.

## Cambios locales inspeccionados (no sobrescritos)

Al crear este inventario, `git status --short` mostraba cambios en (posteriormente commiteados en `7fe3722`, junto con `src/charts/`, `src/ai/lfm3.ts`, `docs/data-audit.md` y este documento):

- `.gitignore`
- `app/api/chat/route.ts`
- `components/chat/chart-renderer.tsx`
- `components/reports/report-configurator.tsx`
- `docs/plan/04-dev1-frontend.md`
- `src/server/chat.ts`
- `src/server/reports.test.mjs`
- `src/server/reports.ts`
- Untracked: `.env.example`, `src/charts/`

Se inspeccionaron el diff de esos archivos modificados y el contenido de `.env.example`/la lista de `src/charts/`; no se imprimieron credenciales ni datos personales. En particular, `docs/plan/04-dev1-frontend.md` ya tiene cambios locales que registran progreso de D1-14/D1-15. **No se editó ese archivo ni se alteró ningún cambio local.** Este documento nuevo evita mezclar el inventario general con esos cambios en curso.

## Referencias de evidencia

- Estado funcional y checklists: `docs/plan/04-dev1-frontend.md`, `docs/plan/05-dev2-backend-ia.md`.
- Decisiones, arquitectura y requisitos aún no aceptados: `docs/plan/README.md`, `docs/plan/01-arquitectura-y-datos.md`, `docs/plan/02-contratos-api.md`, `docs/plan/03-fases-y-cronograma.md`, `docs/plan/06-calidad-despliegue-y-riesgos.md`.
- Datos locales observados y límites: `docs/data-audit.md`.
- Estado operativo y prohibiciones de publicación: `docs/operations.md`.
- Implementación identificable: `app/`, `components/`, `src/server/`, `src/db/queries/`, `src/ai/`, `src/data/`, `src/charts/`.

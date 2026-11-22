# Inventario de implementación y pendientes

**Corte:** 2026-11-22. Inventario documental del repositorio y del estado local observado; no constituye aceptación de release. Estado git al iniciar esta tarea: árbol de trabajo limpio; los cambios locales citados aquí quedaron commiteados en `7fe3722`, `7afc26a` y `60d609d`. La evidencia nueva de esta fecha fue aportada por el agente de PDF y por el hilo principal; esta tarea solo editó documentación y no ejecutó pruebas. Los cambios en archivos de chat son del hilo principal y están fuera de este ámbito.

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
| Explorador | Implementado parcialmente | Página, estadísticas y mapa MapLibre con GeoJSON local (14 IDs verificados, sin tiles, licencia `Public Domain / Open Data` declarada); falta evidencia en candidato. |
| Comparador | Implementado en UI/API | Pantalla, selector, tabla y endpoint; aceptación cruzada real y evidencia E2E no cerradas. |
| Chat LFM3 local | Implementación presente, integración/aceptación no resueltas | Proveedor y orquestador existen; disponibilidad del modelo, grounding completo y comportamiento actual no validados. |
| Búsqueda semántica | Desactivada por defecto; compatibilidad bloqueada | Requiere dos variables explícitas; auditoría no confirmó procedencia ni relevancia de embeddings. |
| PDF | Descarga y generación presentes; cierre parcial | Hay reporte de descarga local y cambios recientes para ChartSpec/paginación; faltan criterios y legibilidad final. |
| Operación / release | POC local verificado; publicación pendiente | `docs/poc-local.md` registra el POC Docker local (sin auth ni HTTPS, por ser local) con API, chat y PDF verificados. No hay despliegue público, HTTPS/acceso, rate limit ni backup/rollback ensayados. |

## Estado funcional

### Explorador y visualización territorial

**Implementado en código**

- Rutas de exploración bajo `app/explorador/page.tsx`; shell, filtros/contexto compartido y estado de URL descritos en `docs/plan/04-dev1-frontend.md`.
- Panel de estadísticas (`components/statistics/detail-panel.tsx`) y tabla alternativa (`components/map/department-table.tsx`).
- `components/map/sv-choropleth-map.tsx` dibuja las 14 geometrías con MapLibre desde `/geo/sv-departamentos.geojson`, sin proveedor de tiles; selector de indicador, leyenda y tabla accesible como alternativa.
- API y lógica de estadísticas: `app/api/statistics/route.ts`, `src/server/statistics.ts`, `src/db/queries/statistics.ts`.

**Parcial / no verificado**

- El mapa usa MapLibre 6.19 con el GeoJSON local como `source` y un estilo sin tiles ni servicios externos (`components/map/sv-choropleth-map.tsx`). La selección por mapa y la tabla accesible son equivalentes. D1-04 quedó cerrado: la licencia de las geometrías está declarada en el `metadata` del GeoJSON y en `public/geo/ATTRIBUTION.md`; falta únicamente evidencia en candidato de despliegue.
- Existe `public/geo/sv-departamentos.geojson` (`FeatureCollection` de 14 features). Verificado localmente: sus `properties.departmentId` coinciden con los 14 IDs de `src/data/audited-catalog.json` y declaran en `metadata` `source: "Centro Nacional de Registros (CNR), 2019 / Datos_SV"` y `license: "Public Domain / Open Data"` (ver `public/geo/ATTRIBUTION.md`). MapLibre consume el archivo directamente. `docs/data-audit.md` ya refleja este hallazgo.
- `docs/plan/04-dev1-frontend.md` registra D1-05 y D1-06 como completados con referencias a código/pruebas locales; no se verificó aquí la ejecución actual ni el endpoint de un candidato.

### Comparador

**Implementado en código:** ruta `app/comparador/page.tsx`; componentes en `components/compare/`; endpoint `app/api/compare/route.ts`; servicio `src/server/comparison.ts`.

El plan registra D1-07…D1-09 como completados (selector de departamentos, referencia dinámica, brechas en USD/puntos porcentuales y pruebas de fase 3). Esto es evidencia local consignada, no aprobación del hito I-03: no hay prueba de integración/release en esta tarea y la compatibilidad semántica y la disponibilidad real del LFM3 continúan bloqueando la aceptación integral.

### Chat y modelo local LFM3

**Implementación presente:** interfaz bajo `app/chat/` y `components/chat/`; endpoint `app/api/chat/route.ts`; orquestación `src/server/chat.ts`; runtime acotado `src/server/chat-runtime.ts`; proveedor local `src/ai/provider.ts`; bloques y gráficos respaldados por contratos. El orquestador vivo (`buildBlocks`) ahora emite bloques `chart` con los mismos hechos SQL publicables de la tabla, agrupados por unidad (hasta dos paneles, máx. 30 categorías); el renderer correspondiente es `components/chat/chart-renderer.tsx` y el formateador compartido `src/charts/chart-spec.ts`. `src/ai/chat-service.ts` es un productor antiguo no importado por la app.

**Estado: no declarar el chat actual como resuelto en general.** El plan registra D1-10…D1-12 como completados con evidencia local anterior, pero la ruta y los cambios locales requieren revisión e integración. Una consulta local sobre Santa Ana respondió HTTP 200 con evidencia; la pregunta reportada sobre capacitación solar también respondió HTTP 200 con abstención, pues la muestra no identifica sedes. Esta última respuesta evita inventar lugares, pero no identifica la causa general del 503 ni demuestra que todas las consultas funcionen.

**Evidencia nueva del hilo principal:** en navegador (`Nextdev:3000`) el saludo exacto de la captura responde con capacidades y sin tablas; la pregunta de ingreso en Santa Ana responde en prosa con 521.45 USD estimados, después de corregir el ámbito que antes devolvía otros departamentos. El seguimiento «Sí, muéstramelo en una tabla.» mantiene el territorio e indicador y añade una tabla tras el texto. Tras reconstruir solo la aplicación Docker, estas tres consultas también respondieron HTTP 200 en `127.0.0.1:3001` (153 ms, 46.8 s y 29.4 s); el filtro aplicado a las dos últimas es `["santa-ana"]`. Lint scoped, `tsc` y `pnpm build` pasaron; el lint global tiene 7 errores fuera del chat en filtros/mapa y advertencias del worker generado. No se ejecutaron suites. Son comprobaciones locales, no aceptación de despliegue ni cierre de todos los criterios D1-12; ver `docs/poc-local.md`.

El proveedor está diseñado para LFM3 local vía `@browser-ai/transformers-js`, CPU q4 y `LFM3_MODEL_DIR` (por defecto `models`), sin API remota según la decisión documentada. Una consulta local se completó con evidencia; esto no verifica disponibilidad ni recursos suficientes en un entorno candidato.

En el POC local no se configura control de acceso (`docs/poc-local.md`). Para un despliegue, la ruta de chat documenta el acceso del piloto en gateway/proxy, no en el handler; HTTPS, autenticación del piloto y limitación efectiva no están configurados/versionados en el repositorio, según `docs/operations.md`.

### PDF y gráficos

**Implementación presente:** formulario/descarga en `components/reports/report-configurator.tsx`; API y render en `src/server/report-http.ts` y `src/server/reports.ts`; snapshot/narrativa en `src/server/report-snapshot.ts` y `src/server/report-narrative.ts`; render con Chromium mediante Playwright y ECharts SSR.

**Evidencia parcial:** el plan de frontend registra que `src/contracts/fase5.test.mjs` pasó 3/3 con servidor local, se descargó un PDF desde la interfaz y una fixture sintética de 20 categorías comprobó continuación de tablas, nulos y supresión tras corregir el recorte. La evidencia nueva del agente de PDF contra el POC Docker (`POC_PORT=3001`) está detallada en `docs/poc-local.md`: PDF completo de 5 páginas A4 con gráficos y acentos legibles, 15 categorías de ocupación paginadas 10+5, variantes `n=18` y `n=0` con supresión/vacío visibles y `n` según estadísticas, error 400 JSON y descarga real desde la UI con «Descarga iniciada». Los paneles mixtos no están expuestos por la API actual (solo `records`), así que su legibilidad no se verificó. D1-14 y D1-15 siguen parciales por los criterios restantes; este inventario no repitió esas verificaciones.

**Cambios ya commiteados:** `src/server/reports.ts` pasó a construir gráficos desde `ChartSpec`, compartir `formatChartValue`, separar hasta dos unidades en paneles y rechazar más de dos, paginar tablas en bloques de diez filas y calcular páginas esperadas. `components/reports/report-configurator.tsx` difiere la revocación del object URL y añade `aria-pressed`. Están incluidos en `7fe3722` y commits posteriores; el POC local registró `POST /api/reports/pdf` con 200 y `%PDF-`, ampliado después con el PDF completo de 69,638 B y 5 páginas (`docs/poc-local.md`). Este inventario no repitió pruebas y no los considera cierre de D1-14/D1-15 o D2-15.

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

**Datos faltantes concretos** (según configuración pública y `docs/data-audit.md`; sin acceder a BD ni a vectores en esta tarea):

- Modelo y revisión reales usados en la ingesta, con su `pooling` y el prefijo/instrucción aplicado a la pregunta; distancia declarada y compatibilidad con el modelo de consulta actual.
- Evaluación de relevancia con pares/consultas etiquetados y revisión humana de resultados, incluida comparación de recall frente a una referencia exacta pequeña y autorizada.
- Índice vectorial declarado en la tabla auditada: solo se observó la PK B-tree, sin planes ni mediciones registradas.

La configuración pública (`.env.example` y el Compose del perfil `poc`) no declara `SEMANTIC_SEARCH_ENABLED`/`SEMANTIC_SEARCH_AUDIT`; la compuerta no es evidencia de compatibilidad. La semántica no se activó en esta tarea.

## Operación, seguridad y despliegue

`docs/operations.md` es un runbook de preparación, **no evidencia de entorno publicado**. Consigna que:

- Compose define PostgreSQL local y el servicio `app` bajo el perfil `poc`, que escucha en `127.0.0.1` y sirve solo para prueba local (`docs/poc-local.md`); no hay topología de despliegue publicado, gateway HTTPS, autenticación del piloto, rate limit, monitorización de aplicación ni copias automáticas configuradas.
- El rol usado en la auditoría local tenía `INSERT`, `UPDATE` y `DELETE`; las transacciones read-only de auditoría no corrigen sus permisos permanentes. No se verificó rol de aplicación solo lectura en entorno candidato.
- No se registraron mediciones p50/p95, carga o planes; no se ensayaron rollback de aplicación/restauración de backup.
- Sin autorización y evidencia del entorno, no hacer release, migraciones, importaciones, DDL, restauraciones ni carga contra BD compartida/producción.

El código contiene límites de runtime en chat y rutas de backend, pero límites declarados no demuestran rate limiting, control de acceso o cancelación efectivos en infraestructura. `docs/poc-local.md` registró `GET /api/health` 200 en local; health de contenedor, correlación/logging operativos y el checklist de cierre de `docs/operations.md` siguen pendientes en un candidato. La verificación local es implementación, no aceptación de despliegue.

## Pendientes y bloqueos principales

1. Trabajo local commiteado: `7fe3722` (chat, PDF, mapa, operación y documentación), `7afc26a` (licencia GeoJSON) y `60d609d` (POC Docker y embeddings lazy); el árbol está limpio. Falta la reconciliación con criterios D1/D2 contra un candidato desplegado.
2. No marcar el chat como resuelto hasta verificar preguntas respaldadas, ambigüedad/abstención, fallos de modelo, seguridad y bypass del flujo anterior. El saludo y la respuesta de Santa Ana ya tienen evidencia en navegador de desarrollo; la tabla `followup` sigue en verificación y la validación nueva no se cierra aquí.
3. Mantener búsqueda semántica desactivada hasta documentar procedencia y validar relevancia/compatibilidad de embeddings; los datos faltantes están enumerados en la sección `Semántica`.
4. Cerrado D1-04: GeoJSON con 14 features, IDs verificados, fuente y licencia `Public Domain / Open Data` declaradas en `metadata` y registradas en `public/geo/ATTRIBUTION.md`; MapLibre consume el archivo sin tiles y la coropleta/selección están verificadas en navegador.
5. PDF real verificado en POC local (secciones, paginación, acentos, supresión/vacío y error 400); siguen pendientes los paneles mixtos —no expuestos por la API actual— y el resto de criterios D1-14/D1-15, además de la regresión E2E.
6. Elegir y autorizar entorno, asegurar secretos, rol SELECT efectivo, HTTPS/acceso/rate limit, modelo local y runtime PDF; ensayar health, rollback y restauración de forma aislada.
7. Verificar contra el entorno autorizado sin exponer secretos, filas, prompts personales o embeddings; documentar versión/corte y evidencia no sensible.

## Cambios locales inspeccionados (histórico, ya commiteados)

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

Se inspeccionaron el diff de esos archivos modificados y el contenido de `.env.example`/la lista de `src/charts/`; no se imprimieron credenciales ni datos personales. En particular, `docs/plan/04-dev1-frontend.md` ya tenía cambios que registraban progreso de D1-14/D1-15. Esos cambios históricos están commiteados. Esta tarea no tocó código, pruebas, base de datos ni otros documentos fuera del ámbito acordado.

## Referencias de evidencia

- Estado funcional y checklists: `docs/plan/04-dev1-frontend.md`, `docs/plan/05-dev2-backend-ia.md`.
- Decisiones, arquitectura y requisitos aún no aceptados: `docs/plan/README.md`, `docs/plan/01-arquitectura-y-datos.md`, `docs/plan/02-contratos-api.md`, `docs/plan/03-fases-y-cronograma.md`, `docs/plan/06-calidad-despliegue-y-riesgos.md`.
- Datos locales observados y límites: `docs/data-audit.md`.
- Estado operativo y prohibiciones de publicación: `docs/operations.md`.
- Implementación identificable: `app/`, `components/`, `src/server/`, `src/db/queries/`, `src/ai/`, `src/data/`, `src/charts/`.

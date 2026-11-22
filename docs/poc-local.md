# POC local (sin control de acceso)

Este documento describe el entorno de prueba local. **No es un despliegue publicado**: todos los servicios escuchan en `127.0.0.1` y no se configura HTTPS, autenticación ni rate limit, porque el POC es local y el acceso lo restringe el propio host. Las restricciones de producción siguen en `docs/operations.md`.

## Arranque

Requisitos: Docker + Compose, Node 24, pnpm 12.6 y los archivos ONNX q4 de LFM3 en `./models` (montados solo lectura en el contenedor).

```bash
docker compose --profile poc up -d --build
# app: http://127.0.0.1:3000  (POC_PORT=3001 para cambiarlo)
# db:  127.0.0.1:5432
```

El servicio `app` usa el artefacto `standalone` de Next.js (`Dockerfile`). El runner incluye las librerías del Chromium empaquetado (`@sparticuz/chromium`) y `node_modules` completo, porque el trace de standalone no copia los módulos nativos de pnpm (`onnxruntime-node`, `playwright-core`).

Variables inyectadas por Compose: `DATABASE_URL` (BD del contenedor), `DATA_CATALOG_PATH=/app/src/data/audited-catalog.json`, `LFM3_MODEL_DIR=/app/models`, `EMBEDDING_MODEL`. Compose no define `SEMANTIC_SEARCH_ENABLED` ni `SEMANTIC_SEARCH_AUDIT`, por lo que la compuerta semántica queda desactivada; el pipeline de embeddings se inicializa de forma lazy y no se carga en el POC.

## Verificación ejecutada (2026-11-22)

| Comprobación | Resultado |
| --- | --- |
| `docker compose --profile poc build` | imagen construida |
| `GET /api/health` | 200 |
| `GET /api/catalog` | 200 (4,580 B) |
| `POST /api/statistics` | 200, 14 departamentos |
| `POST /api/compare` | 200, diferencias e ingresos |
| `GET /explorador`, `/chat`, `/reportes` | 200 |
| `GET /geo/sv-departamentos.geojson` | 200 (19,299,493 B) |
| `POST /api/chat` | 200 en 47.1 s, sin timeout de 90 s |
| `POST /api/reports/pdf` | 200, `%PDF-`, 21,493 B |
| `docker logs sv-nemotron-poc` | sin errores ni rejections |

## Verificación PDF adicional (2026-11-22, `POC_PORT=3001`)

Evidencia registrada por el agente de PDF contra el contenedor del perfil `poc` en el puerto 3001:

| Comprobación | Resultado |
| --- | --- |
| `GET /api/health` | 200 |
| `/api/reports/pdf` completo (resumen, educación, ocupación y metas) | 200, `%PDF-`, 69,638 B, 5 páginas A4; gráficos y acentos legibles; ocupación con 15 categorías paginadas 10+5 |
| `/api/reports/pdf` estrecho (`n=18`) y vacío (`n=0`) | 200, 5 páginas; supresión y estado vacío visibles; `n` coincide con estadísticas |
| Payload inválido | 400 con envelope JSON (no se guarda como PDF) |
| Descarga desde la UI | Respuesta binaria 200 y mensaje «Descarga iniciada» |

Artefactos: `/tmp/opencode/report-full.pdf`, `/tmp/opencode/report-narrow.pdf`, `/tmp/opencode/report-empty.pdf` y `/tmp/opencode/report-page-1.png` … `report-page-5.png`.

Los **paneles mixtos no están expuestos por la API actual** (solo `records`), por lo que su legibilidad no se verificó. D1-14 y D1-15 siguen parciales por criterios restantes; ver `docs/plan/04-dev1-frontend.md`. La verificación de chat en navegador (`Nextdev:3000`) corresponde al servidor de desarrollo, no a este contenedor; está registrada en `docs/implementation-inventory.md`.

## Chat conversacional (2026-11-22, navegador en `127.0.0.1:3000`)

- `hola, que datos tienes?`: explicación de los datos disponibles, solo texto, sin herramientas estadísticas (HTTP 200; comprobación HTTP adicional: 164 ms).
- `¿Cuál es el ingreso promedio en Santa Ana?`: respuesta en prosa con 521.45 USD estimados, sin tabla. El nombre territorial ahora restringe la consulta SQL aunque no haya filtros seleccionados.
- `Sí, muéstramelo en una tabla.`: conserva Santa Ana y el indicador del historial; primero responde en prosa y después muestra una tabla de una fila, con unidad legible.
- `gracias`: solo texto, sin herramientas; un territorio contrario al filtro activo solicita aclaración sin consultar; una pregunta causal se abstiene; pregunta vacía devuelve HTTP 400.
- `pnpm build` y `pnpm exec tsc --noEmit`: correctos. ESLint de los archivos de chat modificados: correcto. `pnpm lint` global falla por 7 errores fuera del chat en `components/filters/filter-bar.tsx` y `components/map/sv-choropleth-map.tsx`; además inspecciona el worker generado de MapLibre y emite advertencias. No se ejecutaron suites de pruebas.

Las cifras narradas proceden de hechos SQL publicables; el modelo elige herramientas y hechos, no redacta cifras libres. Las tablas solo se añaden cuando se solicitan o facilitan una comparación amplia; los gráficos se añaden cuando se solicitan. Se respetan solicitudes como «sin tablas» y «solo texto».

### Contenedor actualizado y comprobado

Se reconstruyó y recreó **solo la aplicación** con `POC_PORT=3001 docker compose --profile poc up -d --build --no-deps app`, sin reiniciar PostgreSQL ni cambiar sus datos. Comprobaciones HTTP posteriores contra `127.0.0.1:3001`:

| Consulta | Resultado |
| --- | --- |
| `/api/health` | 200 |
| `hola, que datos tienes?` | 200, solo `text`, sin filtro territorial, 153 ms |
| Ingreso promedio en Santa Ana | 200, solo `text`, 521.45 USD estimados, `appliedFilters.departmentIds=["santa-ana"]`, 46.8 s |
| Seguimiento `Sí, muéstramelo en una tabla.` con historial | 200, `text` seguido de `table`, una fila y mismo filtro/cifra, 29.4 s |

## Notas

- El chat **no tiene límite de tiempo** en el handler ni en el proveedor: la inferencia CPU q4 local tarda decenas de segundos. Solo cancelación del cliente y concurrencia máxima 2.
- La búsqueda semántica no se activó: además de la compuerta, faltan modelo/revisión, `pooling` y prefijo de la ingesta y una evaluación de relevancia; ver `docs/implementation-inventory.md` (`Semántica`). Esto es implementación local, no aceptación para despliegue.
- Para apagar: `docker compose --profile poc down`. Esto no elimina el volumen `db_data`.
- Para publicar fuera del host harían falta HTTPS, acceso del piloto, rate limit, rol `SELECT` y evidencia E2E; ver `docs/operations.md`.

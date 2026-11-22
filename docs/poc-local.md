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

Variables inyectadas por Compose: `DATABASE_URL` (BD del contenedor), `DATA_CATALOG_PATH=/app/src/data/audited-catalog.json`, `LFM3_MODEL_DIR=/app/models`, `EMBEDDING_MODEL`. La búsqueda semántica permanece apagada (no hay embeddings en el POC y el pipeline se crea de forma lazy).

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

## Notas

- El chat **no tiene límite de tiempo** en el handler ni en el proveedor: la inferencia CPU q4 local tarda decenas de segundos. Solo cancelación del cliente y concurrencia máxima 2.
- Para apagar: `docker compose --profile poc down`. Esto no elimina el volumen `db_data`.
- Para publicar fuera del host harían falta HTTPS, acceso del piloto, rate limit, rol `SELECT` y evidencia E2E; ver `docs/operations.md`.

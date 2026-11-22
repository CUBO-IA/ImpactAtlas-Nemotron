This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Estado de la implementación

Consulta el [inventario de implementación y pendientes](docs/implementation-inventory.md) para conocer qué está implementado, qué está parcial y qué permanece bloqueado.

## Base de datos y migración del CSV

La base usa PostgreSQL 17 con pgvector (`docker-compose.yml`). El esquema y
las migraciones de Prisma están en `src/db/contract.prisma` y
`src/db/migrations/`.

Se importaron las 50.000 filas de `src/db/nemotron-sv-muestra.csv` a
`NemotronSvMuestra` con el script versionado
[`src/db/ingest-nemotron.mjs`](src/db/ingest-nemotron.mjs). Para cada fila,
el script genera un embedding de `meta_principal` con
`onnx-community/embeddinggemma-2-ONNX` en CPU (q4), usando el prefijo de
documento de `src/ai/embeddings.ts`. Los vectores normalizados tienen 768
dimensiones y se guardan en pgvector.

### Restaurar la base sin regenerar embeddings

El respaldo versionado [`src/db/nemotron-sv-20261121.sql.xz`](src/db/nemotron-sv-20261121.sql.xz)
contiene el esquema, los datos, los embeddings y los metadatos de migración
de Prisma. Es una instantánea del 21 de noviembre de 2026, no un respaldo
automático de cambios posteriores.

Con Docker, Docker Compose y `xz` instalados, inicia el servicio y espera a
que esté healthy:

```bash
docker compose up -d db
docker compose ps
```

Restaura **solo en una base vacía** del contenedor; no ejecutes esto sobre una
base existente con datos. El comando usa las credenciales configuradas en el
contenedor y aplica el respaldo en una sola transacción:

```bash
set -o pipefail
xz -dc src/db/nemotron-sv-20261121.sql.xz | \
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction'
```

Verifica el resultado:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''SELECT count(*) AS filas, count(embedding) AS embeddings, min(vector_dims(embedding)) AS dimensiones FROM "NemotronSvMuestra"'\'''
```

Debe mostrar 50.000 filas, 50.000 embeddings y 768 dimensiones. La extensión
pgvector debe estar disponible en el servidor de destino.

### Volver a importar el CSV

Con las dependencias instaladas (`pnpm install`), Node.js 24, `DATABASE_URL`
configurada en `.env` y las migraciones aplicadas, ejecuta:

```bash
pnpm db:ingest
```

**Atención:** el script vacía `NemotronSvMuestra` antes de importar y procesa
en lotes; si falla, puede dejar una importación incompleta. Generar los
embeddings requiere descargar el modelo si no está en caché y puede tardar.
El lector está adaptado al CSV actual, que no contiene comas entrecomilladas.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

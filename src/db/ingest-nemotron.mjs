import 'dotenv/config';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import { env } from '@huggingface/transformers';
import contractJson from './contract.json' with { type: 'json' };

env.backends.onnx.wasm.numThreads = 8;
const { documentText, embed } = await import('../ai/embeddings.ts');

const db = postgres({ contract: contractFromJson(contractJson), url: process.env.DATABASE_URL });
const BATCH = 256;
const CSV = new URL('./nemotron-sv-muestra.csv', import.meta.url);

const INSERT_PREFIX = 'INSERT INTO "NemotronSvMuestra" (edad, sexo, departamento, nivel_educativo, ocupacion, ingreso_estimado_usd, sin_acceso_financiero, meta_principal, embedding) VALUES (';

async function ingest(rows) {
  const vectors = await embed(rows.map((r) => documentText(r.meta_principal)));
  const strings = [INSERT_PREFIX];
  const values = [];
  rows.forEach((r, i) => {
    values.push(
      Number(r.edad), r.sexo, r.departamento, r.nivel_educativo, r.ocupacion,
      Number(r.ingreso_estimado_usd), r.sin_acceso_financiero === 'True',
      r.meta_principal, `[${vectors[i].join(',')}]`,
    );
    for (let j = 0; j < 8; j++) strings.push(',');
    strings.push(i === rows.length - 1 ? '::vector)' : '::vector),(');
  });
  await db.execute(db.raw.sql(strings, ...values).affectedCount().build());
}

try {
  await db.execute(db.raw.sql`TRUNCATE "NemotronSvMuestra"`.affectedCount().build());

  const rl = readline.createInterface({ input: createReadStream(CSV), crlfDelay: Infinity });
  let batch = [];
  let total = 0;
  let header = true;
  // ponytail: the sample CSV has no quoted commas; switch to a CSV parser if that changes
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line) continue;
    const [edad, sexo, departamento, nivel_educativo, ocupacion, ingreso_estimado_usd, sin_acceso_financiero, meta_principal] = line.split(',');
    batch.push({ edad, sexo, departamento, nivel_educativo, ocupacion, ingreso_estimado_usd, sin_acceso_financiero, meta_principal });
    if (batch.length === BATCH) {
      await ingest(batch);
      total += batch.length;
      batch = [];
      console.log(`ingested ${total}`);
    }
  }
  if (batch.length) {
    await ingest(batch);
    total += batch.length;
  }
  const check = db.raw.sql`SELECT count(*)::int AS n, count(embedding)::int AS embedded, min(vector_dims(embedding)) AS dims FROM "NemotronSvMuestra"`.returnsRow({
    n: 'pg/int4@1', embedded: 'pg/int4@1', dims: 'pg/int4@1',
  }).build();
  for await (const row of db.query(check)) {
    if (row.n !== total || row.embedded !== total || row.dims !== 768) {
      throw new Error(`ingest verification failed: ${JSON.stringify(row)} (expected ${total} rows, all embedded at 768 dims)`);
    }
  }
  console.log(`done: ${total} rows, all embedded at 768 dims`);
} finally {
  await db.close();
}

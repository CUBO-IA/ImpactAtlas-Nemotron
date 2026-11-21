#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/920a87b50729a867e21706dd0fa5c3739e273a84ed89eb2f3525633b2d6ef85c/contract';
import startContract from '../../snapshots/920a87b50729a867e21706dd0fa5c3739e273a84ed89eb2f3525633b2d6ef85c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e7be10eccf81407cff04be592525d70c7af1bdfc3503ea0d6ec0d4913406304b/contract';
import endContract from '../../snapshots/e7be10eccf81407cff04be592525d70c7af1bdfc3503ea0d6ec0d4913406304b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createExtension({ extension: 'vector', schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'NemotronSvMuestra',
        columns: [
          col('departamento', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('edad', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('embedding', 'vector(768)', {
            notNull: true,
            codecRef: { codecId: 'sql/raw@1', typeParams: { sql: 'vector(768)' } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ingreso_estimado_usd', 'float8', {
            notNull: true,
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('meta_principal', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nivel_educativo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ocupacion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sexo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sin_acceso_financiero', 'bool', {
            notNull: true,
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

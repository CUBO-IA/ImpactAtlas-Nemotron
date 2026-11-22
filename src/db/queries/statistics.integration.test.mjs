import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../db.ts";
import { closeStatisticsCancellationClient, withReadSnapshot, queryHealth } from "./statistics.ts";

test(
  "cancels an active PostgreSQL statement and leaves the pool usable",
  { skip: process.env["RUN_POSTGRES_CANCELLATION_TEST"] !== "1" || !process.env["DATABASE_URL"] },
  async () => {
    const controller = new AbortController();
    let markQueryStarted;
    const queryStarted = new Promise((resolve) => { markQueryStarted = resolve; });
    const startedAt = Date.now();
    const budget = {
      signal: controller.signal,
      deadline: startedAt + 10_000,
    };
    const work = withReadSnapshot(async (tx) => {
      const sleep = setTimeout(() => controller.abort(new Error("integration test cancellation")), 300);
      markQueryStarted();
      try {
        await tx.query(
          tx.raw.sql`SELECT 1 AS value FROM (SELECT pg_sleep(5)) AS wait`
            .returnsRow({ value: { codecId: "pg/int4@1" } }).build(),
        );
      } finally {
        clearTimeout(sleep);
      }
    }, 8_000, 9_000, budget);

    try {
      await Promise.race([
        queryStarted,
        work.then(
          () => { throw new Error("withReadSnapshot resolved before the query callback started"); },
          (error) => { throw error; },
        ),
      ]);
      await assert.rejects(work, /integration test cancellation/);
      assert.ok(Date.now() - startedAt < 3_000, "active query should be cancelled promptly");
      await queryHealth();
    } finally {
      await Promise.allSettled([db.close(), closeStatisticsCancellationClient()]);
    }
  },
);

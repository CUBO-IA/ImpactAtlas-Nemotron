import assert from "node:assert/strict";
import test from "node:test";
import { createStatisticsBudget, StatisticsTimeBudgetError, throwIfStatisticsBudgetExceeded } from "./statistics-budget.ts";

test("statistics deadline aborts its signal and produces the 504-classifiable error", async () => {
  const budget = createStatisticsBudget(undefined, 1);
  try {
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(budget.signal.aborted, true);
    assert.throws(
      () => throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline),
      StatisticsTimeBudgetError,
    );
  } finally {
    budget.dispose();
  }
});

test("statistics budget follows client request cancellation", () => {
  const request = new AbortController();
  const budget = createStatisticsBudget(request.signal);
  try {
    request.abort(new Error("client disconnected"));
    assert.throws(() => throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline), /client disconnected/);
  } finally {
    budget.dispose();
  }
});

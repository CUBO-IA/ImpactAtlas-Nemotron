export const STATISTICS_BUDGET_MS = 15_000;

export class StatisticsTimeBudgetError extends Error {
  constructor() {
    super("La solicitud excedió el presupuesto de tiempo.");
    this.name = "StatisticsTimeBudgetError";
  }
}

export type StatisticsBudget = {
  signal: AbortSignal;
  deadline: number;
  dispose: () => void;
};

export function createStatisticsBudget(
  requestSignal?: AbortSignal,
  budgetMs = STATISTICS_BUDGET_MS,
): StatisticsBudget {
  const controller = new AbortController();
  const deadline = Date.now() + budgetMs;
  const timer = setTimeout(() => controller.abort(new StatisticsTimeBudgetError()), budgetMs);
  const signal = requestSignal ? AbortSignal.any([requestSignal, controller.signal]) : controller.signal;
  return { signal, deadline, dispose: () => clearTimeout(timer) };
}

export function throwIfStatisticsBudgetExceeded(signal: AbortSignal, deadline: number): void {
  if (Date.now() >= deadline) throw new StatisticsTimeBudgetError();
  if (signal.aborted) {
    if (signal.reason instanceof StatisticsTimeBudgetError) throw signal.reason;
    signal.throwIfAborted();
  }
}

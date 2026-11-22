import type { ChartSpec } from "../contracts/chat.ts";

export function formatChartValue(value: number | null, unit: ChartSpec["series"][number]["unit"]): string {
  if (value === null) return "N/D";
  if (unit === "usd_estimated") return `$${value.toFixed(2)}`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "percentage_points") return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
  return value.toLocaleString("es-SV");
}

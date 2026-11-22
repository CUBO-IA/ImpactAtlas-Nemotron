import { healthResponseSchema } from "../../../src/contracts/common.ts";

export async function GET() {
  const payload = { status: "ok" as const };
  const parsed = healthResponseSchema.parse(payload);
  return Response.json(parsed);
}

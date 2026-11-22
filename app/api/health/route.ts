import { healthResponseSchema } from "@/src/contracts/common";
import { connection } from "next/server";
import { queryHealth } from "@/src/db/queries/statistics";


export async function GET() {
  await connection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      queryHealth(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("health timeout")), 1500);
      }),
    ]);
    return Response.json(healthResponseSchema.parse({ status: "ok" }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(healthResponseSchema.parse({ status: "unavailable" }), {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

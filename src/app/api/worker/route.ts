/**
 * Worker Trigger API Route.
 * Protected by INTERNAL_CRON_SECRET.
 */

import { env } from "@/config/env";
import { workerPipeline } from "@/modules/worker/worker-pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, "");

  if (!providedSecret || providedSecret !== env.INTERNAL_CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const drainResult = await workerPipeline.drainBatch(20);
    return new Response(JSON.stringify({ success: true, ...drainResult }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Worker trigger failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Cron maintenance route for worker queue draining and data retention purging.
 */

import { env } from "@/config/env";
import { businessConfig } from "@/config/business.config";
import { workerPipeline } from "@/modules/worker/worker-pipeline";
import { retentionService } from "@/modules/retention/retention.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== env.INTERNAL_CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const drainResult = await workerPipeline.drainBatch(20);

    let purgedCount = 0;
    if (businessConfig.features.enableDataRetentionCleanup) {
      purgedCount = await retentionService.purgeExpiredCommentData();
    }

    return new Response(
      JSON.stringify({
        success: true,
        queue: drainResult,
        purgedExpiredRecords: purgedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

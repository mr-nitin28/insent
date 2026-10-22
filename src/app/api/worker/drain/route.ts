/**
 * Manual Worker Drain Trigger for Dashboard.
 */

import { NextResponse } from "next/server";
import { workerPipeline } from "@/modules/worker/worker-pipeline";

export const runtime = "nodejs";

export async function POST() {
  try {
    const drainResult = await workerPipeline.drainBatch(25);
    return NextResponse.json({ success: true, ...drainResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

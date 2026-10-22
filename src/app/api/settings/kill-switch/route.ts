/**
 * Emergency Kill Switch API Route.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace();
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("kill_switch_active")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    return NextResponse.json({ active: data?.kill_switch_active ?? false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { active } = body;
    const workspaceId = await getOrCreateDefaultWorkspace();

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          workspace_id: workspaceId,
          kill_switch_active: Boolean(active),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" },
      )
      .select("kill_switch_active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, active: data.kill_switch_active });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

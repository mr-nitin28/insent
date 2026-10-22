/**
 * Automation Rule by ID management (Toggle Status / Delete).
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { automationsService } from "@/modules/automations/automations.service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (status !== "active" && status !== "paused") {
      return NextResponse.json({ error: "Status must be 'active' or 'paused'" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, account_id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.account_id) {
      automationsService.clearAccountCache(data.account_id);
    }

    return NextResponse.json({ success: true, rule: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: rule } = await supabaseAdmin
      .from("automation_rules")
      .select("account_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("automation_rules").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (rule?.account_id) {
      automationsService.clearAccountCache(rule.account_id);
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

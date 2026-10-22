/**
 * Dashboard Telemetry & Stats API Endpoint.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [
      { count: pendingCount },
      { count: sendingCount },
      { count: sentTodayCount },
      { count: failedCount },
      { count: unknownCount },
      { count: totalCount },
      { data: accounts },
      { data: rules },
      { data: recentRuns },
      { data: settings },
      { data: links },
    ] = await Promise.all([
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "sending"),
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "sent")
        .gte("sent_at", startOfToday.toISOString()),
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "failed"),
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "unknown_delivery"),
      supabaseAdmin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabaseAdmin
        .from("social_accounts")
        .select(
          "id, platform, account_id, username, name, profile_picture_url, status, hourly_cap, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("automation_rules")
        .select(
          "id, name, priority, match_mode, keywords, post_scope, destination_ref, message_template, public_reply_template, status, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("priority", { ascending: true }),
      supabaseAdmin
        .from("automation_runs")
        .select(
          "id, rule_id, comment_id, commenter_username, comment_text, status, reason, attempts, created_at, sent_at",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("app_settings")
        .select("kill_switch_active")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabaseAdmin
        .from("tracked_links")
        .select("id, slug, destination_url, click_count, created_at")
        .eq("workspace_id", workspaceId)
        .order("click_count", { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      stats: {
        pending: pendingCount ?? 0,
        sending: sendingCount ?? 0,
        sentToday: sentTodayCount ?? 0,
        failed: failedCount ?? 0,
        unknownDelivery: unknownCount ?? 0,
        total: totalCount ?? 0,
      },
      killSwitchActive: settings?.kill_switch_active ?? false,
      accounts: accounts ?? [],
      rules: rules ?? [],
      recentRuns: recentRuns ?? [],
      links: links ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Automation Rules API: List rules and create new rules with collision validation.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { automationsService } from "@/modules/automations/automations.service";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import type { MatchMode } from "@/core/matching";
import type { ScopeType, MediaSnapshotItem } from "@/core/rules";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace();
    let rulesData: unknown[] = [];
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select(
        "id, workspace_id, account_id, name, priority, match_mode, keywords, scope_type, target_media_ids, target_media_snapshot, post_scope, destination_ref, message_template, public_reply_template, status, version, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("priority", { ascending: true });

    if (error) {
      if (error.message.includes("does not exist") || error.code === "42703") {
        const fallback = await supabaseAdmin
          .from("automation_rules")
          .select(
            "id, workspace_id, account_id, name, priority, match_mode, keywords, post_scope, destination_ref, message_template, public_reply_template, status, version, created_at",
          )
          .eq("workspace_id", workspaceId)
          .order("priority", { ascending: true });

        if (fallback.error) {
          return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        }
        rulesData = fallback.data ?? [];
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      rulesData = data ?? [];
    }

    return NextResponse.json({ rules: rulesData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      accountId,
      name,
      priority = 1,
      matchMode = "whole_word",
      keywords,
      scopeType = "specific",
      targetMediaIds = [],
      targetMediaSnapshot = [],
      postScope = null,
      destinationRef,
      messageTemplate,
      publicReplyTemplate = null,
    } = body;

    if (!accountId || !name || !keywords || !destinationRef || !messageTemplate) {
      return NextResponse.json(
        { error: "accountId, name, keywords, destinationRef, and messageTemplate are required" },
        { status: 400 },
      );
    }

    const keywordList = Array.isArray(keywords)
      ? keywords
          .map(String)
          .map((k) => k.trim())
          .filter(Boolean)
      : String(keywords)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);

    if (keywordList.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    const mediaIds = Array.isArray(targetMediaIds)
      ? targetMediaIds.map(String).filter(Boolean)
      : postScope
        ? [String(postScope)]
        : [];

    const workspaceId = await getOrCreateDefaultWorkspace();

    const created = await automationsService.createRule({
      workspaceId,
      accountId,
      name,
      priority: Number(priority) || 1,
      matchMode: matchMode as MatchMode,
      keywords: keywordList,
      scopeType: (scopeType as ScopeType) || (mediaIds.length > 0 ? "specific" : "all"),
      targetMediaIds: mediaIds,
      targetMediaSnapshot: Array.isArray(targetMediaSnapshot)
        ? (targetMediaSnapshot as MediaSnapshotItem[])
        : [],
      postScope: mediaIds[0] ?? postScope ?? null,
      destinationRef,
      messageTemplate,
      publicReplyTemplate: publicReplyTemplate || null,
      status: "active",
    });

    return NextResponse.json({ success: true, rule: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

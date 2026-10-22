/**
 * Automation Rules API: List rules and create new rules with collision validation.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { automationsService } from "@/modules/automations/automations.service";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import type { MatchMode } from "@/core/matching";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace();
    const { data, error } = await supabaseAdmin
      .from("automation_rules")
      .select(
        "id, workspace_id, account_id, name, priority, match_mode, keywords, post_scope, destination_ref, message_template, public_reply_template, status, version, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("priority", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data ?? [] });
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

    const workspaceId = await getOrCreateDefaultWorkspace();

    const created = await automationsService.createRule({
      workspaceId,
      accountId,
      name,
      priority: Number(priority) || 1,
      matchMode: matchMode as MatchMode,
      keywords: keywordList,
      postScope: postScope || null,
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

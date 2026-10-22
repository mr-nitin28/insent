/**
 * Seed script for local development and demonstration.
 */

import { supabaseAdmin } from "../src/lib/supabase";
import { encryptToken } from "../src/channels/instagram/crypto";

async function runSeed() {
  console.log("🌱 Seeding initial workspace and automation rules...");

  // 1. Workspace
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .upsert(
      {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "Default Creator Workspace",
        owner_id: "local_dev_user",
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (wsErr) {
    console.warn("Workspace seed note (might already exist or offline Supabase):", wsErr.message);
  } else {
    console.log(`✅ Seeded workspace: ${workspace.id}`);
  }

  // 2. Encrypted Token for Local Instagram Account
  const encrypted = encryptToken("mock_ig_long_lived_token_for_local_development");

  const { data: account, error: accErr } = await supabaseAdmin
    .from("social_accounts")
    .upsert(
      {
        id: "b0000000-0000-0000-0000-000000000001",
        workspace_id: "a0000000-0000-0000-0000-000000000001",
        platform: "instagram",
        account_id: "17841400000000001",
        username: "anozik_creator",
        name: "Anozik Demo Creator",
        encrypted_access_token: encrypted.encryptedData,
        token_iv: encrypted.iv,
        token_auth_tag: encrypted.authTag,
        status: "connected",
        hourly_cap: 600,
      },
      { onConflict: "platform,account_id" },
    )
    .select()
    .maybeSingle();

  if (accErr) {
    console.warn("Account seed note:", accErr.message);
  } else if (account) {
    console.log(`✅ Seeded social account: @${account.username}`);
  }

  // 3. Automation Rules
  const { error: ruleErr } = await supabaseAdmin.from("automation_rules").upsert(
    [
      {
        id: "c0000000-0000-0000-0000-000000000001",
        workspace_id: "a0000000-0000-0000-0000-000000000001",
        account_id: "b0000000-0000-0000-0000-000000000001",
        name: "Portfolio Auto DM",
        priority: 1,
        match_mode: "whole_word",
        keywords: ["portfolio", "design"],
        post_scope: null,
        destination_ref: "demo/portfolio",
        message_template: "Hey @{username}! Here is my portfolio link: {link}",
        public_reply_template: "Sent to your DMs! Check message requests if you don't follow. ✨",
        status: "active",
      },
    ],
    { onConflict: "id" },
  );

  if (ruleErr) {
    console.warn("Rule seed note:", ruleErr.message);
  } else {
    console.log("✅ Seeded automation rule: 'Portfolio Auto DM'");
  }

  console.log("🎉 Seed finished successfully!");
}

void runSeed();

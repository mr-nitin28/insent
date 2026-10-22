/**
 * Workspace resolution helper for standalone and individual installations.
 */

import { supabaseAdmin } from "./supabase";

export const DEFAULT_WORKSPACE_ID = "a0000000-0000-0000-0000-000000000001";

export async function getOrCreateDefaultWorkspace(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("id", DEFAULT_WORKSPACE_ID)
    .maybeSingle();

  if (data?.id) {
    return data.id;
  }

  const { data: created, error } = await supabaseAdmin
    .from("workspaces")
    .insert({
      id: DEFAULT_WORKSPACE_ID,
      name: "Default Creator Workspace",
      owner_id: "local_dev_user",
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to initialize workspace: ${error?.message}`);
  }

  return created.id;
}

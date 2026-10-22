/**
 * Retention service for GDPR/privacy compliance.
 * Anonymizes commenter identifiers and comment details after configured retention period.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { businessConfig } from "@/config/business.config";

export const retentionService = {
  async purgeExpiredCommentData(retentionDays?: number): Promise<number> {
    const days = retentionDays ?? businessConfig.limits.retentionDays;
    const cutoffDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("automation_runs")
      .update({
        commenter_id: null,
        commenter_username: "[redacted]",
        comment_text: "[redacted]",
        updated_at: new Date().toISOString(),
      })
      .lt("created_at", cutoffDate)
      .not("commenter_id", "is", null)
      .select("id");

    if (error) {
      throw new Error(`Failed to execute data retention purge: ${error.message}`);
    }

    return data?.length ?? 0;
  },
};

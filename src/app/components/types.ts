/**
 * Dashboard UI TypeScript contracts.
 */

export interface DashboardStats {
  pending: number;
  sending: number;
  sentToday: number;
  failed: number;
  unknownDelivery: number;
  total: number;
}

export interface DashboardAccount {
  id: string;
  platform: string;
  account_id: string;
  username: string;
  name: string | null;
  profile_picture_url: string | null;
  status: "connected" | "needs_reauth" | "disconnected";
  hourly_cap: number;
  created_at: string;
}

export interface DashboardRule {
  id: string;
  name: string;
  priority: number;
  match_mode: "exact" | "whole_word" | "contains";
  keywords: string[];
  post_scope: string | null;
  destination_ref: string;
  message_template: string;
  public_reply_template: string | null;
  status: "active" | "paused";
  created_at: string;
}

export interface DashboardRun {
  id: string;
  rule_id: string | null;
  comment_id: string;
  commenter_username: string | null;
  comment_text: string | null;
  status: "pending" | "sending" | "sent" | "skipped" | "failed" | "unknown_delivery";
  reason: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  killSwitchActive: boolean;
  accounts: DashboardAccount[];
  rules: DashboardRule[];
  recentRuns: DashboardRun[];
  links: Array<{ id: string; slug: string; destination_url: string; click_count: number }>;
}

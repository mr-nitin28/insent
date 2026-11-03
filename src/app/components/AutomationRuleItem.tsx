"use client";

import {
  ExternalLink,
  Film,
  Video,
  Clock,
  Sparkles,
  Globe,
  Image as ImageIcon,
  Power,
  Trash2,
} from "lucide-react";
import type { DashboardRule } from "./types";

interface AutomationRuleItemProps {
  rule: DashboardRule;
  loading: boolean;
  onToggleStatus: (rule: DashboardRule) => void;
  onDelete: (id: string, name: string) => void;
}

export function AutomationRuleItem({
  rule,
  loading,
  onToggleStatus,
  onDelete,
}: AutomationRuleItemProps) {
  const isPaused = rule.status === "paused";
  const snapshots = rule.target_media_snapshot ?? [];
  const hasSnapshots = snapshots.length > 0;
  const targetIds = rule.target_media_ids ?? (rule.post_scope ? [rule.post_scope] : []);
  const scope = rule.scope_type ?? (targetIds.length > 0 ? "specific" : "all");

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${
        isPaused
          ? "border-slate-200 bg-slate-100/50 opacity-75"
          : "border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02),0_4px_12px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="text-sm font-semibold text-slate-800 break-words">{rule.name}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-600 border border-slate-200/60">
              Priority {rule.priority}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-600 uppercase border border-slate-200/60">
              {rule.match_mode.replace("_", " ")}
            </span>

            {/* Scope Badge */}
            {scope === "all" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-600 border border-slate-200/60">
                <Globe className="h-3 w-3 text-slate-400" />
                All Posts
              </span>
            ) : scope === "next_post" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-indigo-700 border border-indigo-200/80">
                <Sparkles className="h-3 w-3 text-indigo-600" />
                Next Post
              </span>
            ) : scope === "story" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-amber-700 border border-amber-200/80">
                <Clock className="h-3 w-3 text-amber-600" />
                Active Story
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-800 border border-emerald-200/80">
                <Film className="h-3 w-3 text-emerald-600" />
                {targetIds.length > 1 ? `${targetIds.length} Posts/Reels` : "Specific Post/Reel"}
              </span>
            )}
          </div>

          {/* Target Media Snapshot Strip */}
          {hasSnapshots && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {snapshots.slice(0, 3).map((snap) => {
                const thumb = snap.thumbnailUrl || snap.mediaUrl;
                const isReel = snap.mediaProductType === "REELS";
                return (
                  <div
                    key={snap.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1 pr-2 text-[11px] text-slate-700 max-w-[240px]"
                  >
                    <div className="relative h-7 w-7 rounded overflow-hidden bg-slate-200 shrink-0">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt="Target media thumbnail"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          {isReel ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="truncate">{snap.caption || snap.id}</span>
                    {snap.permalink && (
                      <a
                        href={snap.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-slate-700 shrink-0"
                        title="View on Instagram"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
              {snapshots.length > 3 && (
                <span className="text-[10px] font-medium text-slate-500">
                  +{snapshots.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Keywords tag pills */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-normal mr-1">Triggers:</span>
            {rule.keywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/80"
              >
                {kw}
              </span>
            ))}
          </div>

          {/* Destination preview */}
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-normal shrink-0">Destination:</span>
            <code className="rounded-md bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 flex items-center gap-1 truncate max-w-[200px] sm:max-w-md">
              <span className="truncate">{rule.destination_ref}</span>
              <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
            </code>
          </div>

          {/* Template preview */}
          <p className="mt-2 text-xs font-normal text-slate-600 line-clamp-2 italic">
            &quot;{rule.message_template}&quot;
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => onToggleStatus(rule)}
            disabled={loading}
            className={`rounded-lg p-1.5 transition ${
              isPaused
                ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                : "text-emerald-600 hover:bg-emerald-50"
            }`}
            title={isPaused ? "Activate Rule" : "Pause Rule"}
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(rule.id, rule.name)}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
            title="Delete Rule"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

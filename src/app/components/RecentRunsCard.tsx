"use client";

import { Activity, MessageSquare, Clock } from "lucide-react";
import type { DashboardRun } from "./types";

interface RecentRunsCardProps {
  runs: DashboardRun[];
}

export function RecentRunsCard({ runs }: RecentRunsCardProps) {
  function getStatusBadge(status: DashboardRun["status"]) {
    switch (status) {
      case "sent":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
      case "pending":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "sending":
        return "bg-amber-50 text-amber-700 ring-amber-600/20";
      case "failed":
        return "bg-rose-50 text-rose-700 ring-rose-600/20";
      case "skipped":
        return "bg-slate-100 text-slate-600 ring-slate-300";
      case "unknown_delivery":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_8px_24px_-4px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_2px_6px_rgba(15,23,42,0.04),0_12px_28px_-4px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Live Queue Activity Feed
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            Recent comment events ingested, evaluated, and dispatched through the pipeline.
          </p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
          <MessageSquare className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No Runs Yet</h3>
          <p className="mt-1 text-xs font-normal text-slate-500 max-w-sm mx-auto">
            Once Instagram sends comments matching your active rules, they will appear live here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
          {runs.map((run) => (
            <div
              key={run.id}
              className="py-3 px-2 -mx-2 rounded-xl transition-colors hover:bg-slate-50/70 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs text-slate-800">
                    @{run.commenter_username || "anonymous"}
                  </span>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(run.created_at)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600 font-normal line-clamp-1">
                  &ldquo;{run.comment_text || "(empty comment)"}&rdquo;
                </p>

                {run.reason && (
                  <p className="mt-1 text-[11px] text-slate-400 truncate">Reason: {run.reason}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border uppercase ${getStatusBadge(
                    run.status,
                  )}`}
                >
                  {run.status.replace("_", " ")}
                </span>
                {run.attempts > 0 && (
                  <span className="text-[10px] text-slate-400">Attempts: {run.attempts}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

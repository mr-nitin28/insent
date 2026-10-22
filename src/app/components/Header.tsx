"use client";

import { useState } from "react";
import { Play, ShieldAlert, Plus, Instagram, RefreshCw } from "lucide-react";

interface HeaderProps {
  killSwitchActive: boolean;
  isDraining: boolean;
  onToggleKillSwitch: () => Promise<void>;
  onDrainQueue: () => Promise<void>;
  onOpenConnectModal: () => void;
  onOpenCreateRuleModal: () => void;
  onRefresh: () => void;
}

export function Header({
  killSwitchActive,
  isDraining,
  onToggleKillSwitch,
  onDrainQueue,
  onOpenConnectModal,
  onOpenCreateRuleModal,
  onRefresh,
}: HeaderProps) {
  const [isTogglingKill, setIsTogglingKill] = useState(false);

  async function handleKillSwitch() {
    setIsTogglingKill(true);
    try {
      await onToggleKillSwitch();
    } finally {
      setIsTogglingKill(false);
    }
  }

  return (
    <header className="mb-8 border-b border-slate-200/70 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Social Connect
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                killSwitchActive
                  ? "bg-rose-50/80 text-rose-700 border-rose-200/80"
                  : "bg-emerald-50/80 text-emerald-700 border-emerald-200/80"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  killSwitchActive ? "bg-rose-500" : "animate-pulse bg-emerald-500"
                }`}
              />
              {killSwitchActive ? "Emergency Halted" : "Queue Active"}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-normal text-slate-500">
            Autonomous Instagram comment-to-DM automation with zero queues and smart retry guards.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5">
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-3.5 py-2 text-xs font-medium text-white shadow-[0_2px_10px_rgba(225,48,108,0.22)] transition hover:opacity-95 hover:shadow-[0_4px_14px_rgba(225,48,108,0.32)] active:scale-95"
            >
              <Instagram className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Connect Account</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateRuleModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.08)] transition hover:bg-slate-800 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>New Rule</span>
            </button>
          </div>

          {/* Secondary Utilities */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              title="Refresh Dashboard"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleKillSwitch}
              disabled={isTogglingKill}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-95 ${
                killSwitchActive
                  ? "bg-rose-600 text-white shadow-rose-600/20 hover:bg-rose-500"
                  : "border border-slate-200/80 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-600"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {killSwitchActive ? "Kill Switch ON" : "Kill Switch"}
              </span>
            </button>

            <button
              type="button"
              onClick={onDrainQueue}
              disabled={isDraining}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 shrink-0 ${isDraining ? "animate-spin" : ""}`} />
              <span className="truncate">{isDraining ? "Processing..." : "Drain Queue"}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

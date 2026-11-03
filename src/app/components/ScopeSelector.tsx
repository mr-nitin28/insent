"use client";

import { Film, Clock, Sparkles, Globe } from "lucide-react";
import type { ScopeType } from "./types";

interface ScopeSelectorProps {
  scopeType: ScopeType;
  onChangeScopeType: (scope: ScopeType) => void;
}

const TABS = [
  { id: "specific" as const, label: "Specific Post/Reel", icon: Film, color: "text-emerald-600" },
  { id: "story" as const, label: "Active Story", icon: Clock, color: "text-amber-600" },
  { id: "next_post" as const, label: "Next Post", icon: Sparkles, color: "text-indigo-600" },
  { id: "all" as const, label: "All Posts", icon: Globe, color: "text-slate-500" },
];

export function ScopeSelector({ scopeType, onChangeScopeType }: ScopeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Automation Target Scope
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = scopeType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeScopeType(tab.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {scopeType === "next_post" && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <p>
            <strong>Auto-Latch to Next Post:</strong> This automation will automatically attach to
            the very next post or reel published by your connected account.
          </p>
        </div>
      )}

      {scopeType === "all" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 flex items-start gap-2">
          <Globe className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            <strong>Account-Wide Scope:</strong> Comments on any post or reel across your account
            containing your trigger keywords will execute this rule.
          </p>
        </div>
      )}
    </div>
  );
}

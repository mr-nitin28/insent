"use client";

import { useState } from "react";
import { Zap, Plus } from "lucide-react";
import type { DashboardRule } from "./types";
import { AutomationRuleItem } from "./AutomationRuleItem";

interface AutomationRulesCardProps {
  rules: DashboardRule[];
  onOpenCreateRuleModal: () => void;
  onRuleUpdated: () => void;
}

export function AutomationRulesCard({
  rules,
  onOpenCreateRuleModal,
  onRuleUpdated,
}: AutomationRulesCardProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleToggleStatus(rule: DashboardRule) {
    const nextStatus = rule.status === "active" ? "paused" : "active";
    setLoadingId(rule.id);
    try {
      const res = await fetch(`/api/automations/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        onRuleUpdated();
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete rule "${name}"?`)) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      if (res.ok) {
        onRuleUpdated();
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_8px_24px_-4px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_2px_6px_rgba(15,23,42,0.04),0_12px_28px_-4px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
            Active Automation Rules
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500 truncate sm:whitespace-normal">
            Keyword triggers evaluated in-memory with post-specific scope and strict precedence.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateRuleModal}
          className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
        >
          <Plus className="h-3 w-3" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
          <Zap className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No Automation Rules Configured</h3>
          <p className="mt-1 text-xs font-normal text-slate-500 max-w-sm mx-auto">
            Create your first comment keyword rule to start sending instant, tracked direct
            messages.
          </p>
          <button
            type="button"
            onClick={onOpenCreateRuleModal}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-[0_1px_3px_rgba(5,150,105,0.2),0_4px_12px_rgba(5,150,105,0.15)] transition hover:bg-emerald-500 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Automation Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <AutomationRuleItem
              key={rule.id}
              rule={rule}
              loading={loadingId === rule.id}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { ConnectedAccountsCard } from "./components/ConnectedAccountsCard";
import { AutomationRulesCard } from "./components/AutomationRulesCard";
import { RecentRunsCard } from "./components/RecentRunsCard";
import { TrackedLinksCard } from "./components/TrackedLinksCard";
import { ConnectAccountModal } from "./components/ConnectAccountModal";
import { CreateRuleModal } from "./components/CreateRuleModal";
import type { DashboardData } from "./components/types";
import { Info, CheckCircle2, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDraining, setIsDraining] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isRuleOpen, setIsRuleOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (res.ok) {
        const json: DashboardData = await res.json();
        setData(json);
      }
    } catch (err: unknown) {
      console.error("Refresh error:", err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
        if (res.ok && active) {
          const json: DashboardData = await res.json();
          setData(json);
        }
      } catch (err: unknown) {
        console.error("Dashboard fetch error:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitial();
    const timer = setInterval(() => {
      void loadInitial();
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function handleToggleKillSwitch() {
    if (!data) return;
    const nextState = !data.killSwitchActive;
    try {
      const res = await fetch("/api/settings/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextState }),
      });
      if (res.ok) {
        setData({ ...data, killSwitchActive: nextState });
        showToast(
          nextState ? "error" : "success",
          nextState
            ? "Emergency Kill Switch Activated: Outgoing DMs halted."
            : "Kill Switch Deactivated: Normal operations resumed.",
        );
      }
    } catch {
      showToast("error", "Failed to update kill switch");
    }
  }

  async function handleDrainQueue() {
    setIsDraining(true);
    try {
      const res = await fetch("/api/worker/drain", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        showToast(
          "success",
          `Queue batch drained: ${result.sent} sent, ${result.delayed} delayed, ${result.unknown} safe-halted.`,
        );
        void refreshData();
      } else {
        showToast("error", result.error || "Failed to drain queue");
      }
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Error draining queue");
    } finally {
      setIsDraining(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-medium text-white shadow-2xl transition ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <Header
        killSwitchActive={data?.killSwitchActive ?? false}
        isDraining={isDraining}
        onToggleKillSwitch={handleToggleKillSwitch}
        onDrainQueue={handleDrainQueue}
        onOpenConnectModal={() => setIsConnectOpen(true)}
        onOpenCreateRuleModal={() => setIsRuleOpen(true)}
        onRefresh={() => void refreshData()}
      />

      {/* Meta Policy Notice */}
      <div className="mb-6 sm:mb-8 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/50 p-3.5 sm:p-4 text-xs text-slate-700 shadow-[0_1px_3px_rgba(245,158,11,0.04),0_6px_20px_-4px_rgba(245,158,11,0.06)]">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <p className="leading-relaxed text-slate-600 font-normal">
            <span className="inline-flex items-center rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/80 mr-1.5">
              Meta Platform Policy
            </span>
            Automated private replies to commenters who do not follow your account are routed to
            their <em className="text-slate-800 font-medium not-italic">Message Requests</em>{" "}
            folder. Ensure public replies or post captions instruct users to check their requests
            folder.
          </p>
        </div>
      </div>

      {/* Telemetry Stats */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-3 lg:grid-cols-6 mb-6 sm:mb-8 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03),0_4px_14px_rgba(15,23,42,0.04)]"
            />
          ))}
        </div>
      ) : data ? (
        <StatsCards stats={data.stats} />
      ) : null}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Left Column: Accounts & Automations */}
        <div className="space-y-6 lg:col-span-2">
          <ConnectedAccountsCard
            accounts={data?.accounts ?? []}
            onOpenConnectModal={() => setIsConnectOpen(true)}
            onAccountDeleted={() => {
              showToast("success", "Account disconnected");
              void refreshData();
            }}
          />

          <AutomationRulesCard
            rules={data?.rules ?? []}
            onOpenCreateRuleModal={() => setIsRuleOpen(true)}
            onRuleUpdated={() => {
              showToast("success", "Automation rule updated");
              void refreshData();
            }}
          />
        </div>

        {/* Right Column: Feed & Analytics */}
        <div className="space-y-6">
          <RecentRunsCard runs={data?.recentRuns ?? []} />
          <TrackedLinksCard links={data?.links ?? []} />
        </div>
      </div>

      {/* Modals */}
      <ConnectAccountModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onConnected={() => {
          showToast("success", "Account successfully connected!");
          void refreshData();
        }}
      />

      <CreateRuleModal
        isOpen={isRuleOpen}
        accounts={data?.accounts ?? []}
        onClose={() => setIsRuleOpen(false)}
        onRuleCreated={() => {
          showToast("success", "Automation rule created successfully!");
          void refreshData();
        }}
      />
    </main>
  );
}

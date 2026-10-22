"use client";

import { useState } from "react";
import { Instagram, Trash2, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import type { DashboardAccount } from "./types";

interface ConnectedAccountsCardProps {
  accounts: DashboardAccount[];
  onOpenConnectModal: () => void;
  onAccountDeleted: () => void;
}

export function ConnectedAccountsCard({
  accounts,
  onOpenConnectModal,
  onAccountDeleted,
}: ConnectedAccountsCardProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Are you sure you want to disconnect @${username}?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        onAccountDeleted();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_8px_24px_-4px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_2px_6px_rgba(15,23,42,0.04),0_12px_28px_-4px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Instagram className="h-4 w-4 text-rose-500 shrink-0" />
            Connected Accounts
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500 truncate sm:whitespace-normal">
            Authorized Instagram channels with AES-256-GCM token encryption.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
        >
          <Plus className="h-3 w-3" />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white font-medium text-base mb-3 shadow-[0_4px_12px_rgba(225,48,108,0.25)]">
            IG
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Connected Accounts</h3>
          <p className="mt-1 text-xs font-normal text-slate-500 max-w-sm mx-auto">
            Connect an Instagram Creator or Business account to begin automated DM dispatches.
          </p>
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.08)] transition hover:bg-slate-800 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Your Account
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-2 -mx-2 rounded-xl transition-colors hover:bg-slate-50/70"
            >
              <div className="flex items-center gap-3 min-w-0">
                {acc.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={acc.profile_picture_url}
                    alt={acc.username}
                    className="h-10 w-10 shrink-0 rounded-full border border-slate-200/80 object-cover shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white font-medium text-xs shadow-[0_2px_6px_rgba(225,48,108,0.2)]">
                    {acc.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-800 flex items-center gap-1.5 truncate">
                    <span className="truncate">@{acc.username}</span>
                    {acc.name && (
                      <span className="text-xs font-normal text-slate-500 truncate">
                        ({acc.name})
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs font-normal text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Hourly Cap: {acc.hourly_cap} DMs/hr</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {acc.account_id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                    acc.status === "connected"
                      ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/80"
                      : "bg-amber-50/80 text-amber-700 border-amber-200/80"
                  }`}
                >
                  {acc.status === "connected" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Reauth Needed
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => handleDelete(acc.id, acc.username)}
                  disabled={deletingId === acc.id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Disconnect Account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

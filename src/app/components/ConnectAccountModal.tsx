"use client";

import { useState } from "react";
import { X, Instagram, Key, ArrowRight, ShieldCheck } from "lucide-react";

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectAccountModal({ isOpen, onClose, onConnected }: ConnectAccountModalProps) {
  const [activeTab, setActiveTab] = useState<"token" | "oauth">("token");
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [hourlyCap, setHourlyCap] = useState("600");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDirectConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().replace(/^@/, ""),
          accessToken: accessToken.trim(),
          accountId: accountId.trim() || undefined,
          hourlyCap: Number(hourlyCap) || 600,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect account");
      }

      onConnected();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthRedirect() {
    window.location.href = "/api/oauth/connect";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white font-medium text-sm shadow-[0_2px_8px_rgba(225,48,108,0.25)]">
              IG
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Connect Instagram Account</h2>
              <p className="text-xs font-normal text-slate-500">
                Secure AES-256-GCM token storage at rest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="mt-4 flex rounded-xl bg-slate-100/80 p-1 border border-slate-200/70 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("token")}
            className={`flex-1 rounded-lg py-1.5 transition ${
              activeTab === "token"
                ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Direct Token (Instant)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("oauth")}
            className={`flex-1 rounded-lg py-1.5 transition ${
              activeTab === "oauth"
                ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Instagram OAuth Login
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {activeTab === "token" ? (
          <form onSubmit={handleDirectConnect} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instagram Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-7 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instagram Long-Lived Access Token <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAA..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Obtained from Meta App Developer Dashboard or Graph API Explorer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scoped Account ID (Optional)
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Auto-detected if empty"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hourly DM Cap
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={hourlyCap}
                  onChange={(e) => setHourlyCap(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200/80 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition active:scale-95 text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.08)] hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
              >
                <Key className="h-3.5 w-3.5" />
                {loading ? "Encrypting & Connecting..." : "Save & Connect"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-[0_4px_16px_rgba(225,48,108,0.25)]">
              <Instagram className="h-7 w-7" />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="text-sm font-semibold text-slate-800">Authorize with Instagram</h3>
              <p className="mt-1 text-xs font-normal text-slate-500">
                You will be redirected to Instagram to approve DM and comment automation permissions
                for your creator profile.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-left flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 font-normal">
                Tokens are exchanged for 60-day credentials and encrypted using AES-256-GCM.
              </p>
            </div>
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200/80 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition active:scale-95 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOAuthRedirect}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-5 py-2 text-xs font-medium text-white shadow-[0_2px_10px_rgba(225,48,108,0.22)] hover:opacity-95 transition active:scale-95"
              >
                Continue to Meta
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

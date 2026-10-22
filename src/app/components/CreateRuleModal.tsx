"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import type { DashboardAccount } from "./types";
import { RulePreview } from "./RulePreview";
import { KeywordsInput } from "./KeywordsInput";

interface CreateRuleModalProps {
  isOpen: boolean;
  accounts: DashboardAccount[];
  onClose: () => void;
  onRuleCreated: () => void;
}

export function CreateRuleModal({
  isOpen,
  accounts,
  onClose,
  onRuleCreated,
}: CreateRuleModalProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("1");
  const [matchMode, setMatchMode] = useState<"exact" | "whole_word" | "contains">("whole_word");
  const [keywords, setKeywords] = useState<string[]>(["guide", "link"]);
  const [destinationRef, setDestinationRef] = useState("https://yourlink.com/offer");
  const [messageTemplate, setMessageTemplate] = useState(
    "Hey @{username}! Here is your link: {link}",
  );
  const [publicReply, setPublicReply] = useState("Sent to your DMs! Check message requests ✨");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const selectedAcc = accountId || accounts[0]?.id;
    if (!selectedAcc) return setError("Please connect an account first");
    if (keywords.length === 0) return setError("Please add at least one trigger keyword");

    setLoading(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAcc,
          name: name.trim(),
          priority: Number(priority) || 1,
          matchMode,
          keywords,
          destinationRef: destinationRef.trim(),
          messageTemplate: messageTemplate.trim(),
          publicReplyTemplate: publicReply.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create rule");

      onRuleCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">Create Automation Rule</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Account
              </label>
              <select
                value={accountId || accounts[0]?.id || ""}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rule Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Free Portfolio DM"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Match Mode</label>
              <select
                value={matchMode}
                onChange={(e) =>
                  setMatchMode(e.target.value as "exact" | "whole_word" | "contains")
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="whole_word">Whole Word</option>
                <option value="exact">Exact Match</option>
                <option value="contains">Contains Substring</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <input
                type="number"
                min={1}
                max={100}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <KeywordsInput keywords={keywords} onChange={setKeywords} />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Destination URL</label>
            <input
              type="url"
              required
              value={destinationRef}
              onChange={(e) => setDestinationRef(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">Message Template</label>
              <span className="text-[11px] text-slate-500">{messageTemplate.length}/1000</span>
            </div>
            <textarea
              required
              rows={3}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <RulePreview messageTemplate={messageTemplate} />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Public Reply (Optional)
            </label>
            <input
              type="text"
              value={publicReply}
              onChange={(e) => setPublicReply(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
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
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-xs font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.08)] hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

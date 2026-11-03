"use client";

import { useState } from "react";

interface PastedMediaUrlInputProps {
  onAddUrl: (url: string) => void;
}

export function PastedMediaUrlInput({ onAddUrl }: PastedMediaUrlInputProps) {
  const [pastedUrl, setPastedUrl] = useState("");

  function handleSubmit() {
    if (!pastedUrl.trim()) return;
    onAddUrl(pastedUrl.trim());
    setPastedUrl("");
  }

  return (
    <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5">
      <input
        type="url"
        placeholder="Paste Instagram URL (e.g. https://instagram.com/reel/...)"
        value={pastedUrl}
        onChange={(e) => setPastedUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!pastedUrl.trim()}
        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

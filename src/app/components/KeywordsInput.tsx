"use client";

import { useState } from "react";

interface KeywordsInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

export function KeywordsInput({ keywords, onChange }: KeywordsInputProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed]);
      setInput("");
    }
  }

  function handleRemove(kw: string) {
    onChange(keywords.filter((k) => k !== kw));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">Trigger Keywords</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Type keyword and press Enter"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl border border-slate-200/80 bg-slate-100/90 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/80 transition active:scale-95"
        >
          Add
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            {kw}
            <button
              type="button"
              onClick={() => handleRemove(kw)}
              className="text-emerald-500 hover:text-emerald-800 ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { ExternalLink } from "lucide-react";
import type { MediaSnapshotItem } from "./types";

interface SelectedMediaSummaryProps {
  selectedMedia: MediaSnapshotItem[];
  onRemove: (id: string) => void;
}

export function SelectedMediaSummary({ selectedMedia, onRemove }: SelectedMediaSummaryProps) {
  if (selectedMedia.length === 0) return null;

  return (
    <div className="pt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-700">
        Selected ({selectedMedia.length}):
      </span>
      {selectedMedia.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
        >
          <span className="max-w-[120px] truncate">{m.caption || m.id}</span>
          {m.permalink && (
            <a
              href={m.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-900"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onRemove(m.id)}
            className="ml-0.5 text-emerald-500 hover:text-emerald-800"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

"use client";

import { Eye } from "lucide-react";

interface RulePreviewProps {
  messageTemplate: string;
}

export function RulePreview({ messageTemplate }: RulePreviewProps) {
  const preview = messageTemplate
    .replace("{username}", "creator_fan")
    .replace("{link}", "https://yourlink.com/r/a1b2c3d4");

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 mb-1">
        <Eye className="h-3 w-3 text-slate-400" /> Live DM Preview
      </div>
      <p className="text-xs text-slate-700 italic line-clamp-3 font-normal">{preview}</p>
    </div>
  );
}

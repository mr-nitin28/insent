"use client";

import { Link2, ExternalLink } from "lucide-react";

interface TrackedLinksCardProps {
  links: Array<{ id: string; slug: string; destination_url: string; click_count: number }>;
}

export function TrackedLinksCard({ links }: TrackedLinksCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_8px_24px_-4px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_2px_6px_rgba(15,23,42,0.04),0_12px_28px_-4px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-purple-600" />
            Tracked Link Analytics
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            Bot-filtered conversion redirects generated for DMs.
          </p>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center bg-slate-50/50">
          <p className="text-xs font-normal text-slate-500">
            No tracked links generated yet. Links are generated automatically when DMs are sent.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {links.map((link) => (
            <div
              key={link.id}
              className="py-2.5 px-2 -mx-2 rounded-xl transition-colors hover:bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-slate-800 flex items-center gap-1.5 font-medium">
                  /r/{link.slug}
                  <a
                    href={`/r/${link.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-700 shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 truncate max-w-[170px] xs:max-w-xs sm:max-w-md mt-0.5">
                  ➔ {link.destination_url}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50/80 text-purple-700 border border-purple-200/80">
                  {link.click_count} {link.click_count === 1 ? "click" : "clicks"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

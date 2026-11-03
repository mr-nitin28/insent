"use client";

import { Video, Image as ImageIcon, Layers, Clock, Film, Check } from "lucide-react";
import type { MetaMediaItem } from "@/channels/instagram/meta-client";

interface MediaCardProps {
  item: MetaMediaItem;
  selected: boolean;
  onToggle: (item: MetaMediaItem) => void;
}

export function MediaCard({ item, selected, onToggle }: MediaCardProps) {
  const isReel = item.media_product_type === "REELS";
  const isCarousel = item.media_type === "CAROUSEL_ALBUM";
  const thumb = item.thumbnail_url || item.media_url;

  return (
    <div
      onClick={() => onToggle(item)}
      className={`group relative flex flex-col overflow-hidden rounded-lg border cursor-pointer transition-all ${
        selected
          ? "border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
      }`}
    >
      {/* Media Thumbnail */}
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={item.caption || "Instagram media"}
            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Film className="h-8 w-8" />
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs">
          {isReel ? (
            <>
              <Video className="h-2.5 w-2.5" />
              <span>REEL</span>
            </>
          ) : isCarousel ? (
            <>
              <Layers className="h-2.5 w-2.5" />
              <span>CAROUSEL</span>
            </>
          ) : item.media_product_type === "STORY" ? (
            <>
              <Clock className="h-2.5 w-2.5" />
              <span>STORY</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-2.5 w-2.5" />
              <span>POST</span>
            </>
          )}
        </div>

        {/* Selected Checkmark Badge */}
        {selected && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <Check className="h-3 w-3 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Caption Preview */}
      <div className="p-1.5">
        <p className="line-clamp-2 text-[10px] text-slate-700 leading-tight">
          {item.caption || "(No caption)"}
        </p>
      </div>
    </div>
  );
}

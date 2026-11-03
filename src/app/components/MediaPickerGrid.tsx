"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Loader2, AlertCircle, Sparkles } from "lucide-react";
import type { ScopeType, MediaSnapshotItem } from "./types";
import type { MetaMediaItem } from "@/channels/instagram/meta-client";
import { MediaCard } from "./MediaCard";
import { ScopeSelector } from "./ScopeSelector";
import { PastedMediaUrlInput } from "./PastedMediaUrlInput";
import { SelectedMediaSummary } from "./SelectedMediaSummary";
import { DEMO_MEDIA_ITEMS } from "./demoMedia";

interface MediaPickerGridProps {
  accountId: string;
  scopeType: ScopeType;
  selectedMedia: MediaSnapshotItem[];
  onChangeScopeType: (scope: ScopeType) => void;
  onChangeSelectedMedia: (media: MediaSnapshotItem[]) => void;
}

export function MediaPickerGrid({
  accountId,
  scopeType,
  selectedMedia,
  onChangeScopeType,
  onChangeSelectedMedia,
}: MediaPickerGridProps) {
  const [items, setItems] = useState<MetaMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "reels" | "posts">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!accountId) return;
    if (scopeType !== "specific" && scopeType !== "story") return;

    let active = true;
    const apiType = scopeType === "story" ? "stories" : "all";

    async function loadMedia() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/accounts/media?accountId=${encodeURIComponent(accountId)}&type=${apiType}&limit=30`,
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Failed to fetch Instagram media (${res.status})`);
        }
        const data = await res.json();
        if (active) setItems(data.media ?? []);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMedia();
    return () => {
      active = false;
    };
  }, [accountId, scopeType]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType === "reels" && item.media_product_type !== "REELS") return false;
      if (
        filterType === "posts" &&
        item.media_product_type !== "FEED" &&
        Boolean(item.media_product_type)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const captionMatch = item.caption ? item.caption.toLowerCase().includes(q) : false;
        if (!captionMatch && !item.id.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  function isSelected(id: string) {
    return selectedMedia.some((m) => m.id === id);
  }

  function handleToggleMedia(item: MetaMediaItem) {
    if (isSelected(item.id)) {
      onChangeSelectedMedia(selectedMedia.filter((m) => m.id !== item.id));
    } else {
      onChangeSelectedMedia([
        ...selectedMedia,
        {
          id: item.id,
          caption: item.caption,
          permalink: item.permalink,
          mediaUrl: item.media_url,
          thumbnailUrl: item.thumbnail_url || item.media_url,
          mediaProductType:
            item.media_product_type === "REELS"
              ? "REELS"
              : item.media_product_type === "STORY"
                ? "STORY"
                : "FEED",
          timestamp: item.timestamp,
        },
      ]);
    }
  }

  function handleAddPastedUrl(url: string) {
    const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    const identifier = match && match[2] ? match[2] : url;

    const found = items.find(
      (i) => i.id === identifier || (i.permalink && i.permalink.includes(identifier)),
    );
    if (found) {
      handleToggleMedia(found);
      return;
    }

    const manualSnapshot: MediaSnapshotItem = {
      id: identifier,
      permalink: url.startsWith("http") ? url : `https://www.instagram.com/p/${identifier}/`,
      caption: `Custom Target (${identifier})`,
      mediaProductType: url.includes("/reel/") ? "REELS" : "FEED",
    };

    if (!isSelected(manualSnapshot.id)) {
      onChangeSelectedMedia([...selectedMedia, manualSnapshot]);
    }
  }

  return (
    <div className="space-y-3">
      <ScopeSelector scopeType={scopeType} onChangeScopeType={onChangeScopeType} />

      {(scopeType === "specific" || scopeType === "story") && (
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {scopeType === "specific" ? (
              <div className="flex items-center gap-1">
                {(["all", "reels", "posts"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${
                      filterType === t
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-medium text-amber-800">
                Active 24h Stories ({items.length})
              </span>
            )}

            <div className="relative flex-1 sm:max-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search captions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  {error.toLowerCase().includes("access token")
                    ? "Instagram Account Needs Re-authentication"
                    : "Unable to load Instagram media"}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                {error.toLowerCase().includes("access token")
                  ? "The access token stored for this account is expired, revoked, or a Facebook token without linked Instagram permissions."
                  : error}
              </p>
              <div className="pt-0.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setItems(DEMO_MEDIA_ITEMS);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2.5 py-1 text-[11px] font-medium transition"
                >
                  <Sparkles className="h-3 w-3 text-amber-800" />
                  Load Demo Content (Test Mode)
                </button>
                <span className="text-[10px] text-amber-700">or paste any post URL below</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span>Loading Instagram content...</span>
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-[220px] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={isSelected(item.id)}
                  onToggle={handleToggleMedia}
                />
              ))}
            </div>
          )}

          {!loading && filteredItems.length === 0 && !error && (
            <div className="py-6 text-center text-xs text-slate-500">
              No matching content found for this account.
            </div>
          )}

          {scopeType === "specific" && <PastedMediaUrlInput onAddUrl={handleAddPastedUrl} />}

          <SelectedMediaSummary
            selectedMedia={selectedMedia}
            onRemove={(id) => onChangeSelectedMedia(selectedMedia.filter((m) => m.id !== id))}
          />
        </div>
      )}
    </div>
  );
}

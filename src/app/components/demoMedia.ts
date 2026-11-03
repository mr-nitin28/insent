import type { MetaMediaItem } from "@/channels/instagram/meta-client";

export const DEMO_MEDIA_ITEMS: MetaMediaItem[] = [
  {
    id: "demo_reel_101",
    caption: "5 Mistakes First-Time SaaS Founders Make (Save this for later) 🚀",
    media_product_type: "REELS",
    media_type: "VIDEO",
    thumbnail_url:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&auto=format&fit=crop&q=80",
    permalink: "https://instagram.com/p/demo_reel_101",
    timestamp: new Date().toISOString(),
  },
  {
    id: "demo_post_102",
    caption: "Free 2026 Social Growth Roadmap (Swipe Left for all slides) 📑",
    media_product_type: "FEED",
    media_type: "CAROUSEL_ALBUM",
    thumbnail_url:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80",
    permalink: "https://instagram.com/p/demo_post_102",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo_reel_103",
    caption: "How we automated Instagram DMs in 24 hours without third-party tools ⚡",
    media_product_type: "REELS",
    media_type: "VIDEO",
    thumbnail_url:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&auto=format&fit=crop&q=80",
    permalink: "https://instagram.com/p/demo_reel_103",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "demo_post_104",
    caption: "Behind the scenes: shipping production web features in record time 🖼️",
    media_product_type: "FEED",
    media_type: "IMAGE",
    thumbnail_url:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300&auto=format&fit=crop&q=80",
    permalink: "https://instagram.com/p/demo_post_104",
    timestamp: new Date(Date.now() - 259200000).toISOString(),
  },
];

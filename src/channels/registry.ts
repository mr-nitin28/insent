/**
 * Central registry for channel adapters.
 * Adding a new channel involves implementing ChannelAdapter and adding one line here.
 */

import type { ChannelAdapter } from "./types";
import { instagramAdapter } from "./instagram/adapter";

class ChannelRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  constructor() {
    this.register(instagramAdapter);
  }

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(channelId: string): ChannelAdapter {
    const adapter = this.adapters.get(channelId);
    if (!adapter) {
      throw new Error(`Channel adapter '${channelId}' is not registered`);
    }
    return adapter;
  }

  list(): readonly string[] {
    return Array.from(this.adapters.keys());
  }
}

export const channelRegistry = new ChannelRegistry();

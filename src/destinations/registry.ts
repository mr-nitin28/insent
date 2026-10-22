/**
 * Destination provider registry.
 */

import type { DestinationProvider } from "./types";
import { anozikProvider } from "./anozik/provider";
import { customUrlProvider } from "./custom-url/provider";

class DestinationRegistry {
  private readonly providers = new Map<string, DestinationProvider>();

  constructor() {
    this.register(anozikProvider);
    this.register(customUrlProvider);
  }

  register(provider: DestinationProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): DestinationProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Destination provider '${providerId}' is not registered`);
    }
    return provider;
  }

  list(): readonly string[] {
    return Array.from(this.providers.keys());
  }
}

export const destinationRegistry = new DestinationRegistry();

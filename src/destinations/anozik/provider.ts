/**
 * Anozik Profile & Service Destination Provider.
 * Resolves destination references dynamically using brand domain from business config.
 */

import type { DestinationProvider, DestinationRef, DestinationOption } from "../types";
import { businessConfig } from "@/config/business.config";

export class AnozikDestinationProvider implements DestinationProvider {
  public readonly id = "anozik";
  public readonly label = `${businessConfig.brand.name} Profile Ecosystem`;

  async list(): Promise<DestinationOption[]> {
    return [
      {
        ref: { providerId: this.id, value: "profile", title: "Main Profile Link" },
        label: "Creator Profile Page",
        previewUrl: `https://${businessConfig.brand.domain}/u/{username}`,
      },
      {
        ref: { providerId: this.id, value: "services", title: "Services & Bookings" },
        label: "Creator Services & Paid Bookings",
        previewUrl: `https://${businessConfig.brand.domain}/u/{username}#services`,
      },
    ];
  }

  async resolve(ref: DestinationRef): Promise<{ url: string }> {
    const domain = businessConfig.brand.domain;
    const cleanValue = ref.value.replace(/^\/+/, "");

    if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
      return { url: cleanValue };
    }

    if (cleanValue.startsWith("u/")) {
      return { url: `https://${domain}/${cleanValue}` };
    }

    return { url: `https://${domain}/u/${cleanValue}` };
  }
}

export const anozikProvider = new AnozikDestinationProvider();

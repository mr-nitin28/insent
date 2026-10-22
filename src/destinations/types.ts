/**
 * Destination provider interfaces for pluggable destination models.
 */

export interface DestinationRef {
  readonly providerId: string;
  readonly value: string; // e.g. custom URL or Anozik username/slug
  readonly title?: string;
}

export interface DestinationOption {
  readonly ref: DestinationRef;
  readonly label: string;
  readonly previewUrl: string;
}

export interface DestinationProvider {
  readonly id: string;
  readonly label: string;
  list(workspaceId?: string): Promise<DestinationOption[]>;
  resolve(ref: DestinationRef): Promise<{ url: string }>;
}

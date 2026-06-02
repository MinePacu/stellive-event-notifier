import type { DeliveryMode, PlatformEvent } from "../types.js";

export interface EventAdapter<RawEvent = unknown> {
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
  normalize(raw: RawEvent): PlatformEvent;
  getDedupeKey(raw: RawEvent): string;
  supportsRealtime(): boolean;
  recommendedDeliveryMode(event: PlatformEvent): DeliveryMode;
}


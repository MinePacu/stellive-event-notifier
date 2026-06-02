import type { PlatformEvent } from "../types.js";
import type { EventAdapter } from "./eventAdapter.js";

export class MockOfficialYoutubeUploadAdapter implements EventAdapter<Partial<PlatformEvent>> {
  async start() {}
  async stop() {}
  async healthCheck() {
    return { ok: true, message: "mock official YouTube upload adapter; verify WebSub before production" };
  }
  normalize(raw: Partial<PlatformEvent>): PlatformEvent {
    const now = new Date().toISOString();
    return {
      id: raw.id ?? `evt_${Date.now()}`,
      source: "youtube",
      type: "official_youtube_upload",
      memberId: "stellive-official",
      generationId: "official",
      title: raw.title ?? "스텔라이브 공식 YouTube 업로드",
      body: raw.body ?? "mock upload event",
      appDeepLink: "stellivehub://events/mock-official-youtube",
      platformUrl: raw.platformUrl ?? "https://www.youtube.com/@stellive_official",
      occurredAt: now,
      receivedAt: now,
      dedupeKey: this.getDedupeKey(raw),
      realtimeEligible: true,
      deliveryMode: "standard"
    };
  }
  getDedupeKey(raw: Partial<PlatformEvent>) {
    return `official_youtube_upload:${raw.platformUrl ?? raw.id ?? "mock"}`;
  }
  supportsRealtime() {
    return true;
  }
  recommendedDeliveryMode() {
    return "realtime_best_effort" as const;
  }
}


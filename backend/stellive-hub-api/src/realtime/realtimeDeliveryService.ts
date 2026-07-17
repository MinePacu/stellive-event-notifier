import type { NotificationDeliveryLevel, PlatformEvent, ResolvedNotificationPreference } from "../types.js";

export interface RealtimeQueueItem {
  event: PlatformEvent;
  resolution: ResolvedNotificationPreference;
  deliveryLevel: NotificationDeliveryLevel;
  priority: number;
}

const priorityByType: Record<string, number> = {
  chzzk_live_started: 1,
  youtube_upload: 3,
  official_youtube_upload: 3
};

export class RealtimeDeliveryService {
  private queue: RealtimeQueueItem[] = [];
  private lastEventAt?: string;

  enqueue(event: PlatformEvent, resolution: ResolvedNotificationPreference, deliveryLevel: NotificationDeliveryLevel = "immediate_push") {
    if (!resolution.shouldNotify) return;
    if (deliveryLevel !== "immediate_push") return;
    const priority = resolution.deliveryMode === "realtime_best_effort" ? priorityByType[event.type] ?? 4 : 10;
    this.queue.push({ event, resolution, deliveryLevel, priority });
    this.queue.sort((a, b) => a.priority - b.priority);
    this.lastEventAt = new Date().toISOString();
  }

  drain(): RealtimeQueueItem[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  status() {
    return {
      queueDepth: this.queue.length,
      lastEventAt: this.lastEventAt,
      adapters: [
        { name: "youtube", realtimeCapable: true, mode: "mock_websub", health: "verify_required" },
        { name: "chzzk", realtimeCapable: true, mode: "mock_live_diff", health: "verify_required" },
        { name: "naver_cafe", realtimeCapable: false, mode: "public_search_polling", health: "verify_required" }
      ]
    };
  }
}

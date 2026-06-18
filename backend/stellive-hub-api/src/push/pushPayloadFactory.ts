import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  ResolvedNotificationPreference
} from "../types.js";

type ApnsPriority = "5" | "10";
type FcmPriority = "normal" | "high";

export interface PushPayloadInput {
  event: PlatformEvent;
  resolution: ResolvedNotificationPreference;
  deliveryLevel: NotificationDeliveryLevel;
}

export interface MinimalPushPayload {
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data: {
    eventId: string;
    source: string;
    eventType: string;
    generationId: string;
    memberId: string;
    tapAction: string;
    appDeepLink: string;
    platformUrl: string;
  };
  android: {
    priority: FcmPriority;
    notification?: {
      imageUrl: string;
    };
  };
  apns: {
    headers: {
      "apns-priority": ApnsPriority;
    };
    payload: {
      aps: {
        sound?: "default";
      };
    };
    fcmOptions?: {
      imageUrl: string;
    };
  };
}

const titleByType: Partial<Record<PlatformEvent["type"], string>> = {
  event_announced: "굿즈/행사 일정이 공개됐어요",
  event_sales_open: "굿즈/행사 신청이 시작됐어요",
  event_deadline_soon: "굿즈/행사 마감이 가까워요",
  event_updated: "굿즈/행사 일정이 변경됐어요",
  event_cancelled: "굿즈/행사 일정이 취소됐어요"
};

function pushTitle(event: PlatformEvent): string {
  return titleByType[event.type] ?? "스텔라이브 알림";
}

function pushBody(event: PlatformEvent): string {
  const title = event.title.trim();
  return title.length > 0 ? title : "굿즈/행사 알림";
}

function highPriority(input: PushPayloadInput): boolean {
  return (
    input.deliveryLevel === "immediate_push" &&
    input.resolution.deliveryMode === "realtime_best_effort"
  );
}

function safeThumbnailUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function buildPushPayload(input: PushPayloadInput): MinimalPushPayload {
  const priority = highPriority(input) ? "high" : "normal";
  const apnsPriority = highPriority(input) ? "10" : "5";
  const imageUrl = safeThumbnailUrl(input.event.thumbnailUrl);

  return {
    notification: {
      title: pushTitle(input.event),
      body: pushBody(input.event),
      ...(imageUrl ? { imageUrl } : {})
    },
    data: {
      eventId: input.event.id,
      source: input.event.source,
      eventType: input.event.type,
      generationId: input.event.generationId,
      memberId: input.event.memberId,
      tapAction: input.resolution.tapAction,
      appDeepLink: input.event.appDeepLink ?? "",
      platformUrl: input.event.platformUrl ?? ""
    },
    android: {
      priority,
      ...(imageUrl ? { notification: { imageUrl } } : {})
    },
    apns: {
      headers: {
        "apns-priority": apnsPriority
      },
      payload: {
        aps: highPriority(input) ? { sound: "default" } : {}
      },
      ...(imageUrl ? { fcmOptions: { imageUrl } } : {})
    }
  };
}

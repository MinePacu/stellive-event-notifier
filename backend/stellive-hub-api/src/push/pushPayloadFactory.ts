import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  ResolvedNotificationPreference
} from "../types.js";
import { normalizeSafeImageUrl } from "../notification/imageUrlPolicy.js";

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
    title: string;
    body: string;
    deliveryLevel: NotificationDeliveryLevel;
    summaryGroupId?: string;
    supersedesEventIds?: string;
    tapAction: string;
    appDeepLink: string;
    platformUrl: string;
  };
  android: {
    priority: FcmPriority;
    notification?: {
      channelId?: string;
      imageUrl?: string;
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

const androidChannelByType: Partial<Record<PlatformEvent["type"], string>> = {
  chzzk_live_started: "stellive_chzzk_live",
  chzzk_live_ended: "stellive_chzzk_live",
  youtube_upload: "stellive_youtube",
  official_youtube_upload: "stellive_official_youtube",
  event_announced: "stellive_hub_events",
  event_sales_open: "stellive_hub_events",
  event_deadline_soon: "stellive_hub_events",
  event_updated: "stellive_hub_events",
  event_cancelled: "stellive_hub_events",
  chzzk_chat: "stellive_chzzk_chat",
  chzzk_subscription: "stellive_chzzk_subscription",
  cafe_post: "stellive_cafe_posts"
};

function pushTitle(event: PlatformEvent): string {
  return titleByType[event.type] ?? "스텔라이브 알림";
}

function pushBody(event: PlatformEvent): string {
  const title = event.title.trim();
  return title.length > 0 ? title : "굿즈/행사 알림";
}

function androidChannelId(event: PlatformEvent): string {
  return androidChannelByType[event.type] ?? "stellive_hub_events";
}

function highPriority(input: PushPayloadInput): boolean {
  return (
    input.deliveryLevel === "immediate_push" &&
    input.resolution.deliveryMode === "realtime_best_effort"
  );
}

export function buildPushPayload(input: PushPayloadInput): MinimalPushPayload {
  const priority = highPriority(input) ? "high" : "normal";
  const apnsPriority = highPriority(input) ? "10" : "5";
  const imageUrl = normalizeSafeImageUrl(input.event.thumbnailUrl);
  const title = pushTitle(input.event);
  const body = pushBody(input.event);
  const channelId = androidChannelId(input.event);

  return {
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {})
    },
    data: {
      eventId: input.event.id,
      source: input.event.source,
      eventType: input.event.type,
      generationId: input.event.generationId,
      memberId: input.event.memberId,
      title,
      body,
      deliveryLevel: input.deliveryLevel,
      tapAction: input.resolution.tapAction,
      appDeepLink: input.event.appDeepLink ?? "",
      platformUrl: input.event.platformUrl ?? ""
    },
    android: {
      priority,
      notification: {
        channelId,
        ...(imageUrl ? { imageUrl } : {})
      }
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

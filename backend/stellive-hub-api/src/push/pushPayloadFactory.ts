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

export interface SummaryPushPayloadInput {
  bucketId: string;
  topicKey: string;
  events: PlatformEvent[];
  resolution: ResolvedNotificationPreference;
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

export const SUMMARY_DATA_BUDGET_BYTES = 3_584;

const titleByType: Partial<Record<PlatformEvent["type"], string>> = {
  event_announced: "굿즈/행사 일정이 공개됐어요",
  event_sales_open: "굿즈/행사 신청이 시작됐어요",
  event_deadline_soon: "굿즈/행사 마감이 가까워요",
  event_milestone_due: "굿즈/행사 새 일정이 시작됐어요",
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
  event_milestone_due: "stellive_hub_events",
  event_updated: "stellive_hub_events",
  event_cancelled: "stellive_hub_events",
  chzzk_chat: "stellive_chzzk_chat",
  chzzk_subscription: "stellive_chzzk_subscription",
  cafe_post: "stellive_cafe_posts",
  service_announcement: "stellive_service_announcements"
};

function pushTitle(event: PlatformEvent): string {
  if (event.source === "service_announcement" || event.type === "service_announcement") return event.title;
  return titleByType[event.type] ?? "스텔라이브 알림";
}

function pushBody(event: PlatformEvent): string {
  if (event.source === "service_announcement" || event.type === "service_announcement") return event.body;
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

function summaryText(events: PlatformEvent[]): { title: string; body: string } {
  const latest = events[0];
  if (events.length === 1) return { title: pushTitle(latest), body: pushBody(latest) };
  const recentTitles = events.slice(0, 2).map((event) => event.title.trim()).filter(Boolean);
  const remainder = Math.max(0, events.length - recentTitles.length);
  const body = `${recentTitles.join(", ")}${remainder > 0 ? ` 외 ${remainder}건` : ""}`;
  if (events.every((event) => event.source === "hub_event")) {
    return { title: `굿즈/행사 업데이트 ${events.length}건`, body };
  }
  if (events.every((event) => event.generationId === "official" || event.memberId === "stellive-official")) {
    return { title: `공식 채널 새 소식 ${events.length}건`, body };
  }
  return { title: `새 알림 ${events.length}건`, body };
}

function dataSize(data: MinimalPushPayload["data"]): number {
  return Buffer.byteLength(JSON.stringify(data), "utf8");
}

function trimLastCodePoint(value: string): string {
  return Array.from(value).slice(0, -1).join("");
}

export function buildSummaryPushPayload(input: SummaryPushPayloadInput): MinimalPushPayload {
  if (input.events.length === 0) throw new Error("summary_push_events_required");
  const events = [...input.events].sort(
    (left, right) => new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime()
  );
  const representative = events[0];
  const text = summaryText(events);
  const supersedes = events.slice(0, 10).map((event) => event.id);
  const data: MinimalPushPayload["data"] = {
    eventId: `summary:${input.bucketId}`,
    source: representative.source,
    eventType: representative.type,
    generationId: representative.generationId,
    memberId: representative.memberId,
    title: text.title,
    body: text.body,
    deliveryLevel: "summary_push",
    summaryGroupId: input.topicKey,
    supersedesEventIds: supersedes.join(","),
    tapAction: input.resolution.tapAction,
    appDeepLink: representative.appDeepLink ?? "",
    platformUrl: representative.platformUrl ?? ""
  };

  while (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES && supersedes.length > 1) {
    supersedes.pop();
    data.supersedesEventIds = supersedes.join(",");
  }
  while (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES && data.body.length > 0) data.body = trimLastCodePoint(data.body);
  while (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES && data.platformUrl.length > 0) data.platformUrl = trimLastCodePoint(data.platformUrl);
  while (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES && data.appDeepLink.length > 0) data.appDeepLink = trimLastCodePoint(data.appDeepLink);
  while (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES && data.title.length > 0) data.title = trimLastCodePoint(data.title);
  if (dataSize(data) > SUMMARY_DATA_BUDGET_BYTES) throw new Error("summary_push_data_budget_exceeded");

  return {
    notification: { title: data.title, body: data.body },
    data,
    android: { priority: "normal", notification: { channelId: androidChannelId(representative) } },
    apns: { headers: { "apns-priority": "5" }, payload: { aps: {} } }
  };
}

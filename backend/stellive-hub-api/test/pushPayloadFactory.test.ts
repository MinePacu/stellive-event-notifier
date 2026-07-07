import { describe, expect, it } from "vitest";
import { buildPushPayload } from "../src/push/pushPayloadFactory.js";
import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  PlatformEventType,
  ResolvedNotificationPreference
} from "../src/types.js";

const hubEventTypes: Array<[PlatformEventType, string]> = [
  ["event_announced", "굿즈/행사 일정이 공개됐어요"],
  ["event_sales_open", "굿즈/행사 신청이 시작됐어요"],
  ["event_deadline_soon", "굿즈/행사 마감이 가까워요"],
  ["event_updated", "굿즈/행사 일정이 변경됐어요"],
  ["event_cancelled", "굿즈/행사 일정이 취소됐어요"]
];

function event(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: overrides.id ?? "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
    source: overrides.source ?? "hub_event",
    type: overrides.type ?? "event_sales_open",
    memberId: overrides.memberId ?? "stellive-official",
    generationId: overrides.generationId ?? "official",
    title: overrides.title ?? "공식 굿즈 판매",
    body: overrides.body ?? "판매가 시작됐습니다.",
    thumbnailUrl: overrides.thumbnailUrl,
    platformUrl: Object.hasOwn(overrides, "platformUrl")
      ? (overrides.platformUrl ?? "")
      : "https://example.com/source",
    appDeepLink: Object.hasOwn(overrides, "appDeepLink")
      ? (overrides.appDeepLink ?? "")
      : "stellivehub://hub-events/event-1",
    occurredAt: overrides.occurredAt ?? "2026-06-12T00:00:00.000Z",
    receivedAt: overrides.receivedAt ?? "2026-06-12T00:00:01.000Z",
    dedupeKey: overrides.dedupeKey ?? "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
    rawPayload:
      overrides.rawPayload ??
      ({
        hubEventId: "event-1",
        imageUrl: "https://example.com/forbidden-image.png",
        logoUrl: "https://example.com/forbidden-logo.png",
        providerResponse: { secret: "must-not-forward" }
      } as unknown as Record<string, unknown>),
    realtimeEligible: overrides.realtimeEligible ?? false,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

function resolution(
  overrides: Partial<ResolvedNotificationPreference> = {}
): ResolvedNotificationPreference {
  return {
    eventId: overrides.eventId ?? "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
    deviceId: overrides.deviceId ?? "device-1",
    shouldNotify: overrides.shouldNotify ?? true,
    reason: overrides.reason ?? "allowed",
    matchedRules: overrides.matchedRules ?? ["global:on"],
    tapAction: overrides.tapAction ?? "open_app",
    deliveryMode: overrides.deliveryMode ?? "standard",
    pushPriority: overrides.pushPriority ?? "normal",
    foregroundStreamEligible: overrides.foregroundStreamEligible ?? false
  };
}

describe("buildPushPayload", () => {
  it.each(hubEventTypes)("builds minimal payload for %s", (type, expectedTitle) => {
    const payload = buildPushPayload({
      event: event({ type }),
      resolution: resolution(),
      deliveryLevel: "summary_push"
    });

    expect(payload.notification.title).toBe(expectedTitle);
    expect(payload.notification.body).toBe("공식 굿즈 판매");
    expect(Object.keys(payload.data).sort()).toEqual([
      "appDeepLink",
      "body",
      "deliveryLevel",
      "eventId",
      "eventType",
      "generationId",
      "memberId",
      "platformUrl",
      "source",
      "tapAction",
      "title"
    ]);
    expect(payload.data).toEqual({
      eventId: "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
      source: "hub_event",
      eventType: type,
      generationId: "official",
      memberId: "stellive-official",
      tapAction: "open_app",
      appDeepLink: "stellivehub://hub-events/event-1",
      platformUrl: "https://example.com/source",
      title: expectedTitle,
      body: "공식 굿즈 판매",
      deliveryLevel: "summary_push"
    });
    expect(payload.android.notification?.channelId).toBe("stellive_hub_events");
    expect(JSON.stringify(payload)).not.toContain("forbidden-image");
    expect(JSON.stringify(payload)).not.toContain("forbidden-logo");
    expect(JSON.stringify(payload)).not.toContain("providerResponse");
    expect(JSON.stringify(payload)).not.toContain("must-not-forward");
  });

  it("uses high Android and APNs priority only for realtime immediate pushes", () => {
    const standardPayload = buildPushPayload({
      event: event(),
      resolution: resolution({ deliveryMode: "standard", pushPriority: "normal" }),
      deliveryLevel: "immediate_push"
    });
    const realtimePayload = buildPushPayload({
      event: event(),
      resolution: resolution({ deliveryMode: "realtime_best_effort", pushPriority: "high" }),
      deliveryLevel: "immediate_push"
    });
    const summaryRealtimePayload = buildPushPayload({
      event: event(),
      resolution: resolution({ deliveryMode: "realtime_best_effort", pushPriority: "high" }),
      deliveryLevel: "summary_push"
    });

    expect(standardPayload.android.priority).toBe("normal");
    expect(standardPayload.apns.headers["apns-priority"]).toBe("5");
    expect(realtimePayload.android.priority).toBe("high");
    expect(realtimePayload.apns.headers["apns-priority"]).toBe("10");
    expect(summaryRealtimePayload.android.priority).toBe("normal");
    expect(summaryRealtimePayload.apns.headers["apns-priority"]).toBe("5");
  });

  it("falls back to safe text and empty URLs when optional event links are missing", () => {
    const payload = buildPushPayload({
      event: event({
        title: "",
        appDeepLink: "",
        platformUrl: ""
      }),
      resolution: resolution({ tapAction: "open_platform" }),
      deliveryLevel: "summary_push" as NotificationDeliveryLevel
    });

    expect(payload.notification.body).toBe("굿즈/행사 알림");
    expect(payload.data.tapAction).toBe("open_platform");
    expect(payload.data.appDeepLink).toBe("");
    expect(payload.data.platformUrl).toBe("");
  });

  it("includes allowed HTTPS thumbnail URLs in provider image fields", () => {
    const payload = buildPushPayload({
      event: event({ thumbnailUrl: "https://example.com/event.jpg" }),
      resolution: resolution(),
      deliveryLevel: "immediate_push" as NotificationDeliveryLevel
    });

    expect(payload.notification.imageUrl).toBe("https://example.com/event.jpg");
    expect(payload.android.notification?.imageUrl).toBe("https://example.com/event.jpg");
    expect(payload.apns.fcmOptions?.imageUrl).toBe("https://example.com/event.jpg");
    for (const key of [
      "imageUrl",
      "thumbnailUrl",
      "image",
      "logoUrl",
      "profileImage",
      "posterUrl",
      "rawPayload"
    ]) {
      expect(payload.data).not.toHaveProperty(key);
    }
  });

  it.each([
    "http://example.com/event.jpg",
    "not-a-url",
    `https://example.com/${"a".repeat(2049)}`
  ])("omits unsafe thumbnail URL %s from provider image fields", (thumbnailUrl) => {
      const payload = buildPushPayload({
        event: event({ thumbnailUrl }),
        resolution: resolution(),
        deliveryLevel: "immediate_push" as NotificationDeliveryLevel
      });

      expect(payload.notification).not.toHaveProperty("imageUrl");
      expect(payload.android.notification).toEqual({ channelId: "stellive_hub_events" });
      expect(payload.apns).not.toHaveProperty("fcmOptions");
      expect(payload.data).not.toHaveProperty("thumbnailUrl");
  });

  it.each(["token", "key", "secret", "signature", "auth", "credential"])(
    "omits thumbnail URLs whose query parameter key contains %s",
    (credentialKey) => {
      const payload = buildPushPayload({
        event: event({ thumbnailUrl: `https://example.com/event.jpg?image_${credentialKey}_value=redacted` }),
        resolution: resolution(),
        deliveryLevel: "immediate_push" as NotificationDeliveryLevel
      });

      expect(payload.notification).not.toHaveProperty("imageUrl");
      expect(payload.android.notification).toEqual({ channelId: "stellive_hub_events" });
      expect(payload.apns).not.toHaveProperty("fcmOptions");
    }
  );

  it("does not include HubEvent image metadata in push payload data", () => {
    const payload = buildPushPayload({
      event: event({
        rawPayload: {
          image: {
            policyState: "official_runtime_url",
            url: "https://example.com/event.jpg",
            bytes: "not-allowed"
          },
          logoUrl: "https://example.com/logo.png",
          profileImage: "https://example.com/profile.png",
          posterUrl: "https://example.com/poster.png",
          providerResponse: { private: "not-allowed" }
        }
      }),
      resolution: resolution(),
      deliveryLevel: "immediate_push" as NotificationDeliveryLevel
    });

    const serialized = JSON.stringify(payload);
    for (const forbiddenValue of [
      "event.jpg",
      "bytes",
      "logo.png",
      "profile.png",
      "poster.png",
      "providerResponse",
      "not-allowed"
    ]) {
      expect(serialized).not.toContain(forbiddenValue);
    }
  });
});

import { describe, expect, it } from "vitest";
import { createFcmClient } from "../src/push/fcmClient.js";
import { FcmPushSender } from "../src/push/pushSender.js";
import { buildPushPayload } from "../src/push/pushPayloadFactory.js";
import type { PlatformEvent, ResolvedNotificationPreference } from "../src/types.js";

function event(): PlatformEvent {
  return {
    id: "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
    source: "hub_event",
    type: "event_cancelled",
    memberId: "stellive-official",
    generationId: "official",
    title: "공식 굿즈 취소",
    body: "일정이 취소됐습니다.",
    platformUrl: "https://example.com/source",
    appDeepLink: "stellivehub://hub-events/event-1",
    occurredAt: "2026-06-12T00:00:00.000Z",
    receivedAt: "2026-06-12T00:00:01.000Z",
    dedupeKey: "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
    rawPayload: { hubEventId: "event-1" },
    realtimeEligible: false,
    deliveryMode: "standard"
  };
}

function resolution(): ResolvedNotificationPreference {
  return {
    eventId: "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
    deviceId: "device-1",
    shouldNotify: true,
    reason: "allowed",
    matchedRules: ["global:on"],
    tapAction: "open_app",
    deliveryMode: "standard",
    pushPriority: "normal",
    foregroundStreamEligible: false
  };
}

describe("createFcmClient", () => {
  it("returns disabled client when Firebase config is missing", async () => {
    const client = createFcmClient({});
    const result = await client.send({
      token: "token-redacted",
      payload: buildPushPayload({
        event: event(),
        resolution: resolution(),
        deliveryLevel: "immediate_push"
      })
    });

    expect(client.enabled).toBe(false);
    expect(result).toEqual({ status: "disabled", reason: "fcm_not_configured" });
  });

  it("treats placeholder Firebase secrets as disabled", () => {
    const client = createFcmClient({
      projectId: "replace_with_firebase_project_id",
      clientEmail: "replace_with_firebase_client_email",
      privateKey: "replace_with_firebase_private_key"
    });

    expect(client.enabled).toBe(false);
  });

  it("sends configured payloads through the Firebase sender and returns the provider message id", async () => {
    const sentMessages: unknown[] = [];
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
      sender: {
        async send(message) {
          sentMessages.push(message);
          return "projects/test-project/messages/1";
        }
      }
    });

    const result = await client.send({
      token: "production-token-must-not-appear-in-result",
      payload: buildPushPayload({
        event: event(),
        resolution: resolution(),
        deliveryLevel: "immediate_push"
      })
    });

    expect(client.enabled).toBe(true);
    expect(result).toEqual({ status: "sent", providerMessageId: "projects/test-project/messages/1" });
    expect(sentMessages).toHaveLength(1);
    expect(JSON.stringify(sentMessages[0])).toContain("production-token-must-not-appear-in-result");
    expect(JSON.stringify(result)).not.toContain("production-token-must-not-appear-in-result");
  });
});

describe("FcmPushSender", () => {
  it("normalizes disabled client result without exposing token details", async () => {
    const sender = new FcmPushSender(createFcmClient({}));
    const result = await sender.sendToDevice({
      device: {
        deviceId: "device-1",
        platform: "android",
        pushProvider: "fcm",
        pushToken: "production-token-must-not-appear",
        tokenStatus: "active",
        timezone: "Asia/Seoul"
      },
      payload: buildPushPayload({
        event: event(),
        resolution: resolution(),
        deliveryLevel: "immediate_push"
      })
    });

    expect(JSON.stringify(result)).not.toContain("production-token-must-not-appear");
    expect(result).toEqual({ status: "disabled", reason: "fcm_not_configured" });
  });
});

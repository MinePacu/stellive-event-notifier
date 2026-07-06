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
    thumbnailUrl: "https://example.com/event.jpg",
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
  it("prefers a service account file and normalizes its private key", async () => {
    const credentials: unknown[] = [];
    const sentMessages: unknown[] = [];
    const client = createFcmClient({
      serviceAccountFile: "/server-only/firebase-admin.json",
      serviceAccountFileReader: () => JSON.stringify({
        project_id: "file-project",
        client_email: "file-account@example.invalid",
        private_key: "line-one\\nline-two\nline-three"
      }),
      projectId: "split-project",
      clientEmail: "split-account@example.invalid",
      privateKey: "split-private-key",
      senderFactory(resolved) {
        credentials.push(resolved);
        return { async send(message) { sentMessages.push(message); return "file-message-1"; } };
      }
    });

    const result = await client.send({
      token: "test-device-token",
      payload: buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" })
    });

    expect(client.enabled).toBe(true);
    expect(result).toEqual({ status: "sent", providerMessageId: "file-message-1" });
    expect(sentMessages).toHaveLength(1);
    expect(credentials).toEqual([{
      projectId: "file-project",
      clientEmail: "file-account@example.invalid",
      privateKey: "line-one\nline-two\nline-three"
    }]);
  });

  it("returns a safe disabled client when the service account file is invalid", async () => {
    const client = createFcmClient({
      serviceAccountFile: "/secret/path/firebase-admin.json",
      serviceAccountFileReader: () => "not-json",
      projectId: "split-project",
      clientEmail: "split-account@example.invalid",
      privateKey: "split-private-key"
    });

    const result = await client.send({
      token: "test-device-token",
      payload: buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" })
    });

    expect(client.enabled).toBe(false);
    expect(result).toEqual({ status: "disabled", reason: "fcm_invalid_service_account_file" });
    expect(JSON.stringify(result)).not.toContain("/secret/path");
    expect(JSON.stringify(result)).not.toContain("split-private-key");
  });

  it("returns a safe disabled client when the service account file is missing required fields", () => {
    const client = createFcmClient({
      serviceAccountFile: "/server-only/firebase-admin.json",
      serviceAccountFileReader: () => JSON.stringify({ project_id: "file-project" })
    });

    expect(client.enabled).toBe(false);
  });

  it("uses split env credentials when the service account file is empty", async () => {
    const credentials: unknown[] = [];
    const client = createFcmClient({
      serviceAccountFile: "  ",
      projectId: "split-project",
      clientEmail: "split-account@example.invalid",
      privateKey: "split-key\\nwith-newline",
      senderFactory(resolved) {
        credentials.push(resolved);
        return { async send() { return "split-message-1"; } };
      }
    });

    await client.send({
      token: "test-device-token",
      payload: buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" })
    });

    expect(credentials).toEqual([{
      projectId: "split-project",
      clientEmail: "split-account@example.invalid",
      privateKey: "split-key\nwith-newline"
    }]);
  });

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

  it("normalizes transient retry metadata without exposing the token", async () => {
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: {
        async send() {
          throw Object.assign(new Error("quota"), { code: "messaging/quota-exceeded", retryAfterMs: 45_000 });
        }
      }
    });

    const result = await client.send({
      token: "sensitive-device-token",
      payload: buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" })
    });

    expect(result).toEqual({
      status: "transient_failure",
      providerErrorCode: "messaging/quota-exceeded",
      reason: "messaging/quota-exceeded",
      retryAfterMs: 45_000
    });
    expect(JSON.stringify(result)).not.toContain("sensitive-device-token");
  });

  it("normalizes permanent invalid token failures", async () => {
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: { async send() { throw Object.assign(new Error("invalid"), { code: "messaging/invalid-registration-token" }); } }
    });

    await expect(client.send({
      token: "redacted",
      payload: buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" })
    })).resolves.toMatchObject({ status: "permanent_token_failure" });
  });

  it("maps multicast responses per token and preserves provider image fields", async () => {
    const messages: unknown[] = [];
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: {
        async send() { return "unused"; },
        async sendEachForMulticast(message) {
          messages.push(message);
          return {
            successCount: 1,
            failureCount: 1,
            responses: [
              { success: true, messageId: "message-1" },
              { success: false, error: Object.assign(new Error("invalid"), { code: "messaging/registration-token-not-registered" }) }
            ]
          };
        }
      }
    });
    const payload = buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" });

    const results = await client.sendEach({ tokens: ["token-1", "token-2"], payload });

    expect(results.map((result) => result.status)).toEqual(["sent", "permanent_token_failure"]);
    expect(messages[0]).toMatchObject({ notification: { imageUrl: "https://example.com/event.jpg" } });
  });

  it("chunks multicast sends at 500 tokens", async () => {
    const chunkSizes: number[] = [];
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: {
        async send() { return "unused"; },
        async sendEachForMulticast(message) {
          chunkSizes.push(message.tokens.length);
          return {
            successCount: message.tokens.length,
            failureCount: 0,
            responses: message.tokens.map((_, index) => ({ success: true, messageId: `message-${index}` }))
          };
        }
      }
    });
    const payload = buildPushPayload({ event: event(), resolution: resolution(), deliveryLevel: "immediate_push" });

    expect(await client.sendEach({ tokens: Array.from({ length: 501 }, (_, index) => `token-${index}`), payload })).toHaveLength(501);
    expect(chunkSizes).toEqual([500, 1]);
  });

  it("sends service announcements to the mapped topic without token data", async () => {
    const messages: unknown[] = [];
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: { async send(message) { messages.push(message); return "topic-message-1"; } }
    });

    await expect(client.sendToTopic({
      topic: "service_maintenance",
      title: "공지",
      body: "점검 안내",
      appDeepLink: "stellivehub://announcements/1",
      platformUrl: ""
    })).resolves.toEqual({ status: "sent", providerMessageId: "topic-message-1" });
    expect(messages).toEqual([
      expect.objectContaining({ topic: "service_maintenance", notification: { title: "공지", body: "점검 안내" } })
    ]);
    expect(JSON.stringify(messages)).not.toContain("token");
  });

  it("subscribes and unsubscribes only the supplied service topic allowlist", async () => {
    const calls: unknown[] = [];
    const client = createFcmClient({
      projectId: "test-project",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "test-private-key",
      sender: {
        async send() { return "unused"; },
        async subscribeToTopic(_token, topic) { calls.push({ action: "subscribe", topic }); return {}; },
        async unsubscribeFromTopic(_token, topic) { calls.push({ action: "unsubscribe", topic }); return {}; }
      }
    });

    await client.setTopicSubscriptions({ token: "private-token", topics: ["service_all", "service_incident"], enabled: true });
    const result = await client.setTopicSubscriptions({ token: "private-token", topics: ["service_all"], enabled: false });

    expect(calls).toEqual([
      { action: "subscribe", topic: "service_all" },
      { action: "subscribe", topic: "service_incident" },
      { action: "unsubscribe", topic: "service_all" }
    ]);
    expect(JSON.stringify(result)).not.toContain("private-token");
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

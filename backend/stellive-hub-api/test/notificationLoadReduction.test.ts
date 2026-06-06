import { describe, expect, it } from "vitest";
import { resolveNotificationDelivery } from "../src/notification/loadReductionPolicy.js";
import { applyPushCap } from "../src/notification/pushCapPolicy.js";
import type { PlatformEvent, ResolvedNotificationPreference } from "../src/types.js";

const now = "2026-06-01T00:00:00.000Z";

function event(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: overrides.id ?? "event-1",
    source: overrides.source ?? "chzzk",
    type: overrides.type ?? "chzzk_live_started",
    memberId: overrides.memberId ?? "ayatsuno-yuni",
    generationId: overrides.generationId ?? "gen1",
    title: overrides.title ?? "방송 시작",
    body: overrides.body ?? "mock event",
    appDeepLink: "stellivehub://events/event-1",
    occurredAt: overrides.occurredAt ?? now,
    receivedAt: overrides.receivedAt ?? now,
    dedupeKey: overrides.dedupeKey ?? "event-1",
    realtimeEligible: overrides.realtimeEligible ?? true,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

function resolution(overrides: Partial<ResolvedNotificationPreference> = {}): ResolvedNotificationPreference {
  return {
    eventId: "event-1",
    deviceId: "device-1",
    shouldNotify: true,
    reason: "allowed",
    matchedRules: [],
    tapAction: "open_app",
    deliveryMode: "standard",
    pushPriority: "normal",
    foregroundStreamEligible: false,
    ...overrides
  };
}

describe("notification load reduction", () => {
  it("does not turn blocked preferences back into push delivery", () => {
    const decision = resolveNotificationDelivery(event(), resolution({ shouldNotify: false, reason: "global_off" }));

    expect(decision.deliveryLevel).toBe("in_app_history_only");
    expect(decision.loadReductionReason).toBe("global_off");
    expect(decision.shouldEnqueuePush).toBe(false);
  });

  it("keeps CHZZK live started as immediate push by default", () => {
    const decision = resolveNotificationDelivery(event({ type: "chzzk_live_started" }), resolution());

    expect(decision.deliveryLevel).toBe("immediate_push");
    expect(decision.shouldEnqueuePush).toBe(true);
  });

  it("treats post and upload events as summary candidates by default", () => {
    const decision = resolveNotificationDelivery(event({ source: "youtube", type: "official_youtube_upload" }), resolution());

    expect(decision.deliveryLevel).toBe("summary_push");
    expect(decision.shouldEnqueuePush).toBe(false);
  });

  it("does not downgrade when spike handling is disabled", () => {
    const decision = resolveNotificationDelivery(
      event(),
      resolution(),
      { recentPushCandidatesInWindow: 99 },
      { spikeDowngrade: { enabled: false, automaticEnabled: true, windowSeconds: 60, eventThreshold: 1 } }
    );

    expect(decision.deliveryLevel).toBe("immediate_push");
    expect(decision.loadReductionReason).toBeUndefined();
  });

  it("downgrades one level when spike handling is enabled and threshold is reached", () => {
    const decision = resolveNotificationDelivery(
      event(),
      resolution(),
      { recentPushCandidatesInWindow: 10 },
      { spikeDowngrade: { enabled: true, automaticEnabled: true, windowSeconds: 60, eventThreshold: 10 } }
    );

    expect(decision.deliveryLevel).toBe("summary_push");
    expect(decision.loadReductionReason).toBe("spike_downgraded_to_summary_push");
    expect(decision.shouldEnqueuePush).toBe(false);
  });
});

describe("push cap policy", () => {
  it("keeps the original delivery level below the cap", () => {
    const decision = applyPushCap(
      { deliveryLevel: "immediate_push", loadReductionReason: undefined },
      resolution(),
      { recentPushCount: 1 },
      { enabled: true, windowMinutes: 10, maxPushes: 2, summaryReplacementEnabled: true }
    );

    expect(decision.deliveryLevel).toBe("immediate_push");
  });

  it("replaces individual push with summary when cap is exceeded and replacement is enabled", () => {
    const decision = applyPushCap(
      { deliveryLevel: "immediate_push", loadReductionReason: undefined },
      resolution(),
      { recentPushCount: 2 },
      { enabled: true, windowMinutes: 10, maxPushes: 2, summaryReplacementEnabled: true }
    );

    expect(decision.deliveryLevel).toBe("summary_push");
    expect(decision.loadReductionReason).toBe("push_cap_summary_replacement");
  });

  it("falls back to in-app history when cap is exceeded and summary replacement is disabled", () => {
    const decision = applyPushCap(
      { deliveryLevel: "summary_push", loadReductionReason: undefined },
      resolution(),
      { recentPushCount: 2 },
      { enabled: true, windowMinutes: 10, maxPushes: 2, summaryReplacementEnabled: false }
    );

    expect(decision.deliveryLevel).toBe("in_app_history_only");
    expect(decision.loadReductionReason).toBe("push_cap_exceeded");
  });

  it("does not count blocked notifications as cap-eligible pushes", () => {
    const decision = applyPushCap(
      { deliveryLevel: "in_app_history_only", loadReductionReason: "global_off" },
      resolution({ shouldNotify: false, reason: "global_off" }),
      { recentPushCount: 100 },
      { enabled: true, windowMinutes: 10, maxPushes: 2, summaryReplacementEnabled: true }
    );

    expect(decision.deliveryLevel).toBe("in_app_history_only");
    expect(decision.loadReductionReason).toBe("global_off");
  });
});

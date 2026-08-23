import type { NotificationDeliveryLevel, PlatformEvent, ResolvedNotificationPreference } from "../types.js";
import { applySpikeDowngrade, type SpikeDowngradeConfig, type SpikeDowngradeContext } from "./spikeDowngrade.js";

export interface NotificationLoadReductionContext extends SpikeDowngradeContext {
  recentPushCount?: number;
  rateLimiterSaturated?: boolean;
}

export interface NotificationLoadReductionConfig {
  spikeDowngrade?: SpikeDowngradeConfig;
}

export interface NotificationDeliveryDecision {
  eventId: string;
  deviceId: string;
  deliveryLevel: NotificationDeliveryLevel;
  loadReductionReason?: string;
  action: NotificationDeliveryAction;
}

export type NotificationDeliveryAction = "send_immediate" | "enqueue_summary" | "history_only";

const immediateEventTypes = new Set<PlatformEvent["type"]>([
  "chzzk_live_started",
  "service_announcement",
  "event_sales_open",
  "event_deadline_soon",
  "event_milestone_due",
  "event_cancelled"
]);

function baseDeliveryLevel(event: PlatformEvent, resolution: ResolvedNotificationPreference): NotificationDeliveryLevel {
  if (!resolution.shouldNotify) return "in_app_history_only";
  if (immediateEventTypes.has(event.type)) return "immediate_push";
  return "summary_push";
}

export function resolveNotificationDelivery(
  event: PlatformEvent,
  resolution: ResolvedNotificationPreference,
  context: NotificationLoadReductionContext = {},
  config: NotificationLoadReductionConfig = {}
): NotificationDeliveryDecision {
  if (!resolution.shouldNotify) {
    return {
      eventId: event.id,
      deviceId: resolution.deviceId,
      deliveryLevel: "in_app_history_only",
      loadReductionReason: resolution.reason,
      action: "history_only"
    };
  }

  const baseLevel = baseDeliveryLevel(event, resolution);
  if (event.source === "service_announcement" || event.type === "service_announcement") {
    return {
      eventId: event.id,
      deviceId: resolution.deviceId,
      deliveryLevel: "immediate_push",
      action: "send_immediate"
    };
  }
  const downgraded = applySpikeDowngrade(baseLevel, context, config.spikeDowngrade);

  return {
    eventId: event.id,
    deviceId: resolution.deviceId,
    deliveryLevel: downgraded.deliveryLevel,
    loadReductionReason: downgraded.reason,
    action:
      downgraded.deliveryLevel === "immediate_push"
        ? "send_immediate"
        : downgraded.deliveryLevel === "summary_push"
          ? "enqueue_summary"
          : "history_only"
  };
}

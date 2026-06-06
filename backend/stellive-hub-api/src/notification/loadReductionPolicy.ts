import type { NotificationDeliveryLevel, PlatformEvent, ResolvedNotificationPreference } from "../types.js";
import { applySpikeDowngrade, type SpikeDowngradeConfig, type SpikeDowngradeContext } from "./spikeDowngrade.js";

export interface NotificationLoadReductionContext extends SpikeDowngradeContext {}

export interface NotificationLoadReductionConfig {
  spikeDowngrade?: SpikeDowngradeConfig;
}

export interface NotificationDeliveryDecision {
  eventId: string;
  deviceId: string;
  deliveryLevel: NotificationDeliveryLevel;
  loadReductionReason?: string;
  shouldEnqueuePush: boolean;
}

const immediateEventTypes = new Set<PlatformEvent["type"]>(["chzzk_live_started"]);

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
      shouldEnqueuePush: false
    };
  }

  const baseLevel = baseDeliveryLevel(event, resolution);
  const downgraded = applySpikeDowngrade(baseLevel, context, config.spikeDowngrade);

  return {
    eventId: event.id,
    deviceId: resolution.deviceId,
    deliveryLevel: downgraded.deliveryLevel,
    loadReductionReason: downgraded.reason,
    shouldEnqueuePush: downgraded.deliveryLevel === "immediate_push"
  };
}

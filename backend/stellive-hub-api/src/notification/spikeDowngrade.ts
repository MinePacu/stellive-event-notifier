import type { NotificationDeliveryLevel } from "../types.js";

export interface SpikeDowngradeConfig {
  enabled: boolean;
  automaticEnabled: boolean;
  windowSeconds: number;
  eventThreshold: number;
  downgradeMap?: Partial<Record<NotificationDeliveryLevel, NotificationDeliveryLevel>>;
}

export interface SpikeDowngradeContext {
  recentPushCandidatesInWindow?: number;
}

export interface SpikeDowngradeResult {
  deliveryLevel: NotificationDeliveryLevel;
  reason?: string;
}

const defaultDowngradeMap: Partial<Record<NotificationDeliveryLevel, NotificationDeliveryLevel>> = {
  immediate_push: "summary_push",
  summary_push: "in_app_history_only"
};

export function applySpikeDowngrade(
  deliveryLevel: NotificationDeliveryLevel,
  context: SpikeDowngradeContext,
  config?: SpikeDowngradeConfig
): SpikeDowngradeResult {
  if (!config?.enabled || !config.automaticEnabled) return { deliveryLevel };
  if (context.recentPushCandidatesInWindow === undefined) return { deliveryLevel };
  if (context.recentPushCandidatesInWindow < config.eventThreshold) return { deliveryLevel };

  const downgraded = (config.downgradeMap ?? defaultDowngradeMap)[deliveryLevel];
  if (!downgraded || downgraded === deliveryLevel) return { deliveryLevel };

  return {
    deliveryLevel: downgraded,
    reason: `spike_downgraded_to_${downgraded}`
  };
}

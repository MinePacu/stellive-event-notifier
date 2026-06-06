import type { NotificationDeliveryLevel, ResolvedNotificationPreference } from "../types.js";

export type PushCapScope = "device" | "user" | "system";

export interface PushCapConfig {
  enabled: boolean;
  windowMinutes: number;
  maxPushes: number;
  summaryReplacementEnabled: boolean;
  scope?: PushCapScope;
}

export interface PushCapContext {
  recentPushCount?: number;
}

export interface PushCapDecisionInput {
  deliveryLevel: NotificationDeliveryLevel;
  loadReductionReason?: string;
}

export interface PushCapDecision {
  deliveryLevel: NotificationDeliveryLevel;
  loadReductionReason?: string;
}

export function applyPushCap(
  input: PushCapDecisionInput,
  resolution: ResolvedNotificationPreference,
  context: PushCapContext,
  config?: PushCapConfig
): PushCapDecision {
  if (!resolution.shouldNotify) return input;
  if (!config?.enabled) return input;
  if (context.recentPushCount === undefined || context.recentPushCount < config.maxPushes) return input;

  if (config.summaryReplacementEnabled) {
    return {
      deliveryLevel: "summary_push",
      loadReductionReason: "push_cap_summary_replacement"
    };
  }

  return {
    deliveryLevel: "in_app_history_only",
    loadReductionReason: "push_cap_exceeded"
  };
}

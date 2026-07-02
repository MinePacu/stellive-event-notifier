import type { SecretReadiness } from "./adminAuth.js";

export type AdminHealthStatus = "ok" | "degraded" | "disabled" | "verify_required" | "rate_limited";
export type AdapterHealthStatus = "enabled" | "disabled" | "verify_required" | "rate_limited";
export type AdapterHealthSource = "youtube" | "chzzk" | "x" | "naver_cafe";

export interface AdapterHealth {
  source: AdapterHealthSource;
  status: AdapterHealthStatus;
  reason: string;
  lastCheckedAt: string;
}

export interface NotificationJobSummary {
  queued: number;
  locked: number;
  completed: number;
  failed: number;
  oldestQueuedAt?: string;
}

export interface NotificationJobDiagnostic {
  id: string;
  eventId: string;
  priority: number;
  status: string;
  runAfter: string;
  lockedAt?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSubscriptionDiagnostic {
  id: string;
  source: string;
  targetId: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
}

export interface LiveStatusDiagnostic {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title?: string;
  channelImageUrl?: string;
  viewerCount?: number;
  startedAt?: string;
  platformUrl?: string;
  lastCheckedAt: string;
  sourceVerificationState: string;
}

export interface DeliveryAttemptDiagnostic {
  id: string;
  eventId: string;
  attemptedAt: string;
  deliveredAt?: string;
  status: string;
  reason?: string;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  deliveryMode: string;
  deliveryLevel?: string;
  pushPriority: string;
  providerErrorCode?: string;
}

export interface DeliveryAttemptSummary {
  sent: number;
  queued: number;
  skipped: number;
  failed: number;
}

export interface DailyDeliveryQueuePoint extends DeliveryAttemptSummary {
  date: string;
  total: number;
}

export interface DailyDeliveryQueueTrend {
  timezone: "Asia/Seoul";
  days: number;
  generatedAt: string;
  items: DailyDeliveryQueuePoint[];
  totals: DeliveryAttemptSummary & {
    total: number;
  };
}

export interface AdminOverview {
  service: {
    name: "stellive-hub-api";
    environment: string;
    uptimeSeconds: number;
  };
  database: {
    status: AdminHealthStatus;
    reason: string;
  };
  featureFlags: Record<string, boolean | string>;
  secrets: Record<string, SecretReadiness>;
  queue: NotificationJobSummary;
  adapters: AdapterHealth[];
  recentDelivery: DeliveryAttemptSummary;
  dailyDeliveryQueue: DailyDeliveryQueueTrend;
}

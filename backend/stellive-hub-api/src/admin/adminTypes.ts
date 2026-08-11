import type { SecretReadiness } from "./adminAuth.js";

export type AdminHealthStatus = "ok" | "degraded" | "disabled" | "verify_required" | "rate_limited";
export type AdapterHealthStatus = "enabled" | "disabled" | "verify_required" | "rate_limited";
export type AdapterHealthSource = "youtube" | "chzzk" | "naver_cafe";

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
  missingJobCount?: number;
  oldestMissingJobReceivedAt?: string;
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
  liveCategory?: string;
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

export type ExternalApiCallResultStatus =
  | "ok"
  | "not_modified"
  | "quota_exceeded"
  | "rate_limited"
  | "auth_required"
  | "http_error"
  | "network_error"
  | "timeout"
  | "parse_error"
  | "unknown_error";

export interface ExternalApiCallDailyPoint {
  date: string;
  total: number;
  ok: number;
  failed: number;
  rateLimited: number;
  quotaExceeded: number;
  quotaUnits: number;
  bySource: Record<string, number>;
}

export interface ExternalApiCallTrend {
  timezone: "Asia/Seoul";
  days: number;
  generatedAt: string;
  items: ExternalApiCallDailyPoint[];
  totals: {
    total: number;
    ok: number;
    failed: number;
    rateLimited: number;
    quotaExceeded: number;
    quotaUnits: number;
    bySource: Record<string, number>;
  };
}

export interface ExternalApiCallRecentItem {
  id: string;
  source: string;
  operation: string;
  method: string;
  host: string;
  path: string;
  statusCode?: number;
  resultStatus: ExternalApiCallResultStatus | string;
  durationMs?: number;
  quotaUnits: number;
  rateLimited: boolean;
  errorCode?: string;
  errorReason?: string;
  requestedAt: string;
  completedAt?: string;
}

export interface ExternalApiCallListResult {
  items: ExternalApiCallRecentItem[];
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
  externalApiCalls: {
    daily: ExternalApiCallTrend;
  };
}

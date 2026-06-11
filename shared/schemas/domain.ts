export type CatalogRole = "member" | "representative" | "official_channel" | "placeholder";
export type ActiveStatus = "active" | "upcoming";
export type GenerationType = "generation" | "gamja" | "official" | "upcoming";
export type PlatformSource = "x" | "naver_cafe" | "chzzk" | "youtube" | "hub_event";
export type DeliveryMode = "standard" | "realtime_best_effort";
export type NotificationDeliveryLevel = "immediate_push" | "summary_push" | "in_app_history_only";
export type PushPriority = "normal" | "high";
export type TapAction = "open_app" | "open_platform";

export type PlatformEventType =
  | "x_post"
  | "cafe_post"
  | "chzzk_live_started"
  | "chzzk_live_ended"
  | "chzzk_chat"
  | "chzzk_subscription"
  | "youtube_upload"
  | "youtube_live_scheduled"
  | "youtube_live_started"
  | "youtube_live_ended"
  | "official_x_post"
  | "official_youtube_upload"
  | "event_announced"
  | "event_sales_open"
  | "event_deadline_soon"
  | "event_updated"
  | "event_cancelled";

export type NotificationPreferenceScope =
  | "global"
  | "generation"
  | "member"
  | "platform"
  | "event_type"
  | "generation_platform"
  | "generation_event_type"
  | "member_platform"
  | "member_event_type";

export interface Avatar {
  preferredSource: "permission_granted" | "chzzk_api" | "youtube_api" | "x_api" | "placeholder";
  imageUrl?: string;
  sourcePlatform?: PlatformSource;
  sourceProfileUrl?: string;
  fetchedAt?: string;
  expiresAt?: string;
  attributionLabel?: string;
  licenseStatus: "permission_granted" | "platform_api_display_only" | "unknown";
  rightsNotes?: string;
}

export interface Member {
  id: string;
  koreanName: string;
  englishName: string;
  generationId: string;
  generationName: string;
  unitName: string;
  catalogRole: CatalogRole;
  activeStatus: ActiveStatus;
  roleLabel?: string;
  isPerson: boolean;
  profileImageUrl?: string;
  avatar: Avatar;
  platforms: {
    chzzkChannelId?: string | null;
    youtubeChannelId?: string | null;
    youtubeHandle?: string | null;
    xHandle?: string | null;
    naverCafeQuery?: string | null;
    externalUrls: Record<string, string>;
  };
  supportedEventTypes?: PlatformEventType[];
  excludedEventTypes?: string[];
}

export interface Generation {
  id: string;
  displayName: string;
  unitName: string;
  sortOrder: number;
  type: GenerationType;
  notificationDefaultEnabled: boolean;
}

export interface PlatformEvent {
  id: string;
  source: PlatformSource;
  type: PlatformEventType;
  memberId: string;
  generationId: string;
  title: string;
  body: string;
  thumbnailUrl?: string;
  platformUrl?: string;
  appDeepLink: string;
  occurredAt: string;
  receivedAt: string;
  dedupeKey: string;
  rawPayload?: unknown;
  realtimeEligible: boolean;
  deliveryMode: DeliveryMode;
  ingestionLatencyMs?: number;
  deliveryRequestedAt?: string;
}

export interface RealtimePreference {
  enabled: boolean;
  deliveryMode: DeliveryMode;
  applyToEventTypes: PlatformEventType[];
  useHighPriorityPush: boolean;
  useForegroundRealtimeStream: boolean;
  allowBatteryUsageWarning: boolean;
  updatedAt: string;
}

export interface UserNotificationPreference {
  userId?: string;
  deviceId: string;
  scope: NotificationPreferenceScope;
  generationId?: string;
  memberId?: string;
  source?: PlatformSource;
  eventType?: PlatformEventType;
  enabled: boolean;
  explicitOverride: boolean;
  tapAction: TapAction;
  deliveryMode: DeliveryMode;
  realtimePreference?: RealtimePreference;
  quietHours?: { enabled: boolean; start: string; end: string; timezone: string };
  keywordsAllowlist?: string[];
  keywordsBlocklist?: string[];
  maxNotificationsPerMinute?: number;
  updatedAt: string;
}

export interface ResolvedNotificationPreference {
  eventId: string;
  deviceId: string;
  shouldNotify: boolean;
  reason: string;
  matchedRules: string[];
  tapAction: TapAction;
  deliveryMode: DeliveryMode;
  pushPriority: PushPriority;
  foregroundStreamEligible: boolean;
}

export interface DeliveryAttempt {
  id: string;
  eventId: string;
  deviceId?: string;
  attemptedAt: string;
  deliveredAt?: string;
  status: "queued" | "sent" | "failed" | "skipped";
  reason?: string;
  tapActionUsed: TapAction;
  title: string;
  body: string;
  source: PlatformSource;
  eventType: PlatformEventType;
  generationId: string;
  memberId: string;
  deliveryMode: DeliveryMode;
  deliveryLevel?: NotificationDeliveryLevel;
  loadReductionReason?: string;
  pushPriority: PushPriority;
  deliveryLatencyMs?: number;
  retryCount?: number;
  expiresAt?: string;
}

export interface LiveStatus {
  memberId: string;
  generationId: string;
  platform: "chzzk";
  isLive: boolean;
  title?: string;
  thumbnailUrl?: string;
  viewerCount?: number;
  startedAt?: string;
  platformUrl?: string;
  lastCheckedAt: string;
  realtimeObservedAt?: string;
  sourceVerificationState?: string;
}

export type HubEventCategory =
  | "online_goods"
  | "online_collab"
  | "offline_concert"
  | "offline_collab"
  | "offline_popup"
  | "ticketing";

export type HubEventParticipationMode = "online" | "offline" | "hybrid";

export type HubEventStatus = "announced" | "upcoming" | "open" | "closing_soon" | "ended" | "cancelled";

export type HubEventSourceType = "official" | "member" | "official_collab";

export interface HubEvent {
  id: string;
  category: HubEventCategory;
  participationMode: HubEventParticipationMode;
  status: HubEventStatus;
  title: string;
  summary?: string;
  memberId?: string;
  generationId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceType: HubEventSourceType;
  announcedAt?: string;
  startsAt?: string;
  endsAt?: string;
  purchaseUrl?: string;
  ticketUrl?: string;
  venueName?: string;
  venueAddress?: string;
  notificationEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubEventsSummary {
  openCount: number;
  upcomingCount: number;
  closingSoonCount: number;
  preview: HubEvent[];
}

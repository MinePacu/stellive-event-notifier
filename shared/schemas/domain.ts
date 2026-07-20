export type CatalogRole = "member" | "representative" | "official_channel" | "placeholder";
export type ActiveStatus = "active" | "upcoming";
export type GenerationType = "generation" | "gamja" | "official" | "upcoming";
export type PlatformSource = "naver_cafe" | "chzzk" | "youtube" | "hub_event";
export type DeliveryMode = "standard" | "realtime_best_effort";
export type NotificationDeliveryLevel = "immediate_push" | "summary_push" | "in_app_history_only";
export type PushPriority = "normal" | "high";
export type TapAction = "open_app" | "open_platform";

export type PlatformEventType =
  | "cafe_post"
  | "chzzk_live_started"
  | "chzzk_live_ended"
  | "chzzk_chat"
  | "chzzk_subscription"
  | "youtube_upload"
  | "youtube_live_scheduled"
  | "youtube_live_started"
  | "youtube_live_ended"
  | "official_youtube_upload"
  | "event_announced"
  | "event_sales_open"
  | "event_deadline_soon"
  | "event_milestone_due"
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
  preferredSource: "permission_granted" | "chzzk_api" | "youtube_api" | "placeholder";
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

export const songTypeValues = ["original", "cover", "unknown"] as const;
export type SongType = (typeof songTypeValues)[number];

export const songGenerationFilterValues = ["all", "gen1", "gen2", "gen3"] as const;
export type SongGenerationFilterId = (typeof songGenerationFilterValues)[number];
export type SongCatalogGenerationId = Exclude<SongGenerationFilterId, "all">;
export type MobileSongType = Exclude<SongType, "unknown">;

export interface SongThumbnail {
  url: string;
  width: number;
  height: number;
}

export type YoutubePremiereState = "scheduled" | "live" | "completed" | "unknown";

export interface YoutubePremiereMetadata {
  classification: "assumed";
  state: YoutubePremiereState;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
}

export interface SongCatalogItem {
  id: string;
  youtubeVideoId: string;
  title: string;
  memberId: string;
  memberName: string;
  generationId: SongCatalogGenerationId;
  generationName: string;
  type: MobileSongType;
  sourceUrl: string;
  thumbnail?: SongThumbnail;
  publishedAt: string;
  catalogAddedAt?: string | null;
  premiere?: YoutubePremiereMetadata;
}

export interface SongFilterCount {
  id: string;
  label: string;
  generationId?: SongGenerationFilterId;
  count: number;
}

export interface SongFacetSummary {
  total: number;
  original: number;
  cover: number;
}

export const musicItemTypeValues = ["cover", "original", "other", "unknown"] as const;
export type MusicItemType = (typeof musicItemTypeValues)[number];

export const musicPublicTypeFilterValues = ["all", "cover", "original", "other"] as const;
export type MusicPublicTypeFilter = (typeof musicPublicTypeFilterValues)[number];

export const musicMemberRoleValues = ["main", "collaboration", "group", "unknown"] as const;
export type MusicMemberRole = (typeof musicMemberRoleValues)[number];

export interface MusicMemberSummary {
  id: string;
  nameKo: string;
  nameEn: string;
  role: MusicMemberRole;
}

export interface MusicCatalogItem {
  id: string;
  youtubeVideoId: string;
  title: string;
  type: MusicItemType;
  publishedAt: string | null;
  catalogAddedAt?: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  durationSeconds?: number | null;
  isInstrumental?: boolean;
  specialFlags?: string[];
  classificationStatus?: string;
  members: MusicMemberSummary[];
  youtubeUrl: string;
  sourcePlaylistId: string | null;
  premiere?: YoutubePremiereMetadata;
}

export interface MusicSourcePlaylistSummary {
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  youtubeUrl: string;
  isPrimary: boolean;
}

export interface MusicCatalogDetail extends MusicCatalogItem {
  sourcePlaylists: MusicSourcePlaylistSummary[];
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
  serviceAnnouncementsEnabled?: boolean;
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
  liveCategory?: string;
  channelImageUrl?: string;
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

export type HubEventScheduleMode = "single_window" | "timeline";

export type HubEventScheduleKind =
  | "main_window"
  | "announcement"
  | "sales_open"
  | "ticket_open"
  | "content_reveal"
  | "release"
  | "deadline"
  | "custom";

export type HubEventTimePrecision = "date" | "datetime";

export type HubEventLinkKind =
  | "source"
  | "purchase"
  | "ticket"
  | "reservation"
  | "content"
  | "video"
  | "map"
  | "custom";

export interface HubEventLink {
  id?: string;
  kind: HubEventLinkKind;
  label?: string;
  url: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HubEventScheduleItem {
  id: string;
  kind: HubEventScheduleKind;
  title?: string;
  label: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  timePrecision: HubEventTimePrecision;
  timezone: string;
  actionUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  links?: HubEventLink[];
  notificationEligible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HubCalendarEntryKind = "hub_event" | "member_birthday" | "generation_anniversary";

export type HubCalendarSpecialDayKind = "member_birthday" | "generation_anniversary";

export type HubCalendarSpecialDayPolicyState = "catalog_verified" | "verify_required";

export interface HubCalendarSpecialDay {
  id: string;
  kind: HubCalendarSpecialDayKind;
  title: string;
  generationId: "gen1" | "gen2" | "gen3" | "gamja" | "gen4-upcoming";
  memberId?: string;
  month: number;
  day: number;
  startYear?: number;
  activeStatus: ActiveStatus;
  catalogRole?: "member" | "representative";
  sourceLabel: "카탈로그";
  policyState: HubCalendarSpecialDayPolicyState;
}

export type HubEventImagePolicyState =
  | "none"
  | "official_runtime_url"
  | "third_party_allowed"
  | "verify_required"
  | "blocked";

export interface HubEventImage {
  policyState: HubEventImagePolicyState;
  url?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  altText?: string;
}

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
  scheduleMode?: HubEventScheduleMode;
  scheduleItems?: HubEventScheduleItem[];
  links?: HubEventLink[];
  announcedAt?: string;
  startsAt?: string;
  endsAt?: string;
  purchaseUrl?: string;
  ticketUrl?: string;
  venueName?: string;
  venueAddress?: string;
  image?: HubEventImage;
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

export type ServiceAnnouncementType = "general" | "incident" | "maintenance" | "version_update";
export type ServiceAnnouncementSeverity = "info" | "important" | "critical";
export type ServiceAnnouncementPublicationState = "draft" | "published" | "archived";
export type ServiceAnnouncementPlatform = "android" | "ios";

export interface ServiceAnnouncement {
  id: string;
  type: ServiceAnnouncementType;
  severity: ServiceAnnouncementSeverity;
  title: string;
  summary: string;
  body: string;
  isPinned: boolean;
  targetPlatforms: ServiceAnnouncementPlatform[];
  minimumAppVersion?: string;
  maximumAppVersion?: string;
  appDeepLink?: string;
  externalUrl?: string;
  actionLabel?: string;
  publishedAt: string;
  expiresAt?: string;
  resolvedAt?: string;
  archivedAt?: string;
  attentionRevision: number;
  revision: number;
  updatedAt: string;
}

export interface AnnouncementSummaryItem {
  id: string;
  attentionRevision: number;
  publishedAt: string;
  severity: ServiceAnnouncementSeverity;
  isPinned: boolean;
}

export interface AnnouncementsSummary {
  activeCount: number;
  items: AnnouncementSummaryItem[];
  pinned?: ServiceAnnouncement;
  generatedAt: string;
}

export interface ServiceAnnouncementListResponse {
  items: ServiceAnnouncement[];
  nextCursor?: string | null;
  generatedAt: string;
}

export interface HubCalendarEntry {
  id: string;
  eventId: string;
  entryKind: HubCalendarEntryKind;
  specialDayKind?: HubCalendarSpecialDayKind;
  specialDayLabel?: string;
  scheduleItemId?: string;
  scheduleKind?: HubEventScheduleKind;
  scheduleLabel?: string;
  title: string;
  displayTitle?: string;
  category: HubEventCategory;
  status: HubEventStatus;
  participationMode: HubEventParticipationMode;
  generationId: string;
  memberId?: string;
  startsAt?: string;
  endsAt?: string;
  displayDate: string;
  displayTimeText: string;
  sourceLabel: string;
  appDeepLink: string;
  platformUrl?: string;
}

export interface HubCalendarDay {
  date: string;
  entries: HubCalendarEntry[];
}

export interface HubCalendarResponse {
  timezone: string;
  from: string;
  to: string;
  days: HubCalendarDay[];
}

export interface HubCalendarWidgetSnapshot {
  generatedAt: string;
  timezone: string;
  entries: HubCalendarEntry[];
  staleAfter: string;
}

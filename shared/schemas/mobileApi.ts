import type {
  Generation,
  AnnouncementsSummary,
  HubCalendarWidgetSnapshot,
  HubEventsSummary,
  LiveStatus,
  MusicCatalogItem,
  Member,
  SongCatalogItem,
  SongFacetSummary,
  SongFilterCount,
  UserNotificationPreference,
} from "./domain.js";

export const mobileApiContractVersion = "mobile-api-v1";

export type MobilePlatform = "android" | "ios";
export type PushTokenProvider = "fcm" | "apns_via_fcm";
export type DeviceTokenStatus = "missing" | "active" | "invalid" | "expired";

export interface MobileConfig {
  unofficialProject: true;
  catalogVersion: string;
  officialYoutubeLiveExcluded: true;
  hubCalendarEnabled: boolean;
  foregroundRealtimeEnabled: boolean;
}

export interface BootstrapResponse {
  config: MobileConfig;
  device?: {
    deviceId: string;
    registered: boolean;
    tokenStatus?: DeviceTokenStatus;
  };
  catalog: {
    generations: Generation[];
    members: Member[];
  };
  preferences: UserNotificationPreference[];
  liveStatus: LiveStatus[];
  hubEventsSummary: HubEventsSummary;
  hubCalendarWidgetSnapshot?: HubCalendarWidgetSnapshot;
  announcementsSummary?: AnnouncementsSummary;
  serverTime: string;
}

export interface SongDisplaySettings {
  summaryCards: {
    songs: boolean;
    live: boolean;
    hubEvents: boolean;
    home: boolean;
  };
}

export interface SongFacetsResponse {
  summary: SongFacetSummary;
  generationFilters: SongFilterCount[];
  memberFilters: SongFilterCount[];
  typeFilters: SongFilterCount[];
  displaySettings: SongDisplaySettings;
  serverTime: string;
}

export interface SongListResponse {
  items: SongCatalogItem[];
  nextCursor?: string | null;
  serverTime: string;
}

export interface MusicListResponse {
  items: MusicCatalogItem[];
  nextCursor?: string | null;
  serverTime?: string;
}

export interface MusicDetailResponse {
  item: MusicCatalogItem;
  serverTime: string;
}

export interface MusicMemberMusicResponse {
  member: {
    id: string;
    nameKo: string;
    nameEn: string;
  };
  items: MusicCatalogItem[];
  nextCursor?: string | null;
  serverTime: string;
}

export interface RegisterDeviceRequest {
  deviceId?: string;
  platform: MobilePlatform;
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
}

export interface RegisterDeviceResponse {
  deviceId: string;
  registered: true;
  serverTime: string;
}

export interface UpdateDeviceTokenRequest {
  deviceId: string;
  platform: MobilePlatform;
  provider: PushTokenProvider;
  token: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdateDeviceTokenResponse {
  updated: true;
  tokenStatus: "active";
  serverTime: string;
}

export interface PreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
}

export interface UpdatePreferencesRequest {
  deviceId: string;
  preferences: UserNotificationPreference[];
  clientUpdatedAt: string;
}

export interface UpdatePreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
  conflict?: "server_newer" | "client_applied";
}

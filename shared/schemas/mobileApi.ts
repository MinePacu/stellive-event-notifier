import type {
  Generation,
  HubCalendarWidgetSnapshot,
  HubEventsSummary,
  LiveStatus,
  Member,
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
  xNotificationsEnabled: boolean;
  xDisabledReason?: string;
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

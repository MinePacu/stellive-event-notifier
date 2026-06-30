import type {
  BootstrapResponse,
  DeviceTokenStatus,
  MobilePlatform,
} from "../../../../shared/schemas/mobileApi.js";
import type {
  Generation,
  HubEventsSummary,
  LiveStatus,
  Member,
  UserNotificationPreference,
} from "../types.js";

type CatalogMember = Omit<Member, "activeStatus"> & { activeStatus: string };

interface CatalogLike {
  getGenerations(): Generation[];
  getMembers(): CatalogMember[];
}

interface DeviceLike {
  getDevice(
    deviceId: string,
  ): Promise<{ deviceId: string; tokenStatus: string } | undefined>;
}

interface PreferenceLike {
  listForDevice(deviceId: string): Promise<UserNotificationPreference[]>;
}

interface LiveStatusLike {
  listDiagnostics(): Promise<LiveStatus[]>;
}

interface HubEventsLike {
  summary(): Promise<HubEventsSummary> | HubEventsSummary;
}

interface MemberProfileImageHydratorLike {
  hydrateMembers(members: Member[]): Promise<Member[]>;
}

export interface BootstrapServiceDependencies {
  catalog: CatalogLike;
  devices: DeviceLike;
  preferences: PreferenceLike;
  liveStatus: LiveStatusLike;
  hubEvents: HubEventsLike;
  memberProfileImages?: MemberProfileImageHydratorLike;
  clock?: () => Date;
}

function isCatalogVisible(member: CatalogMember): member is Member {
  return member.activeStatus === "active" || member.activeStatus === "upcoming";
}

function tokenStatus(value: string | undefined): DeviceTokenStatus | undefined {
  if (
    value === "missing" ||
    value === "active" ||
    value === "invalid" ||
    value === "expired"
  ) {
    return value;
  }
  return undefined;
}

export default class BootstrapService {
  private readonly clock: () => Date;

  constructor(private readonly dependencies: BootstrapServiceDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async getBootstrap(input: {
    deviceId?: string;
    platform?: MobilePlatform;
    appVersion?: string;
    locale?: string;
    timezone?: string;
  }): Promise<BootstrapResponse> {
    const device = input.deviceId
      ? await this.dependencies.devices.getDevice(input.deviceId)
      : undefined;
    const preferences = input.deviceId
      ? await this.dependencies.preferences.listForDevice(input.deviceId)
      : [];
    const liveStatus = await this.dependencies.liveStatus.listDiagnostics();
    const members = this.dependencies.catalog.getMembers().filter(isCatalogVisible);
    const hydratedMembers = this.dependencies.memberProfileImages
      ? await this.dependencies.memberProfileImages.hydrateMembers(members)
      : members;

    return {
      config: {
        unofficialProject: true,
        catalogVersion: "seed-2026-06-01",
        officialYoutubeLiveExcluded: true,
        xNotificationsEnabled: false,
        xDisabledReason: "x_notifications_dropped_for_mvp",
        hubCalendarEnabled: true,
        foregroundRealtimeEnabled: false,
      },
      device: device
        ? {
            deviceId: device.deviceId,
            registered: true,
            tokenStatus: tokenStatus(device.tokenStatus),
          }
        : undefined,
      catalog: {
        generations: this.dependencies.catalog.getGenerations(),
        members: hydratedMembers,
      },
      preferences,
      liveStatus,
      hubEventsSummary: await this.dependencies.hubEvents.summary(),
      serverTime: this.clock().toISOString(),
    };
  }
}

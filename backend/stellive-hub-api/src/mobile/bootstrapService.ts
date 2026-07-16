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
import { ShortTtlAsyncCache } from "../utils/shortTtlAsyncCache.js";

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

interface BootstrapCacheTtlSeconds {
  catalog?: number;
  liveStatus?: number;
  hubEventsSummary?: number;
}

interface HydratedCatalog {
  generations: Generation[];
  members: Member[];
}

export interface BootstrapServiceDependencies {
  catalog: CatalogLike;
  devices: DeviceLike;
  preferences: PreferenceLike;
  liveStatus: LiveStatusLike;
  hubEvents: HubEventsLike;
  memberProfileImages?: MemberProfileImageHydratorLike;
  clock?: () => Date;
  cacheTtlSeconds?: BootstrapCacheTtlSeconds;
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

function toMobileDisplayLiveStatus(status: LiveStatus): LiveStatus {
  if (status.sourceVerificationState === "verified") return status;
  return {
    ...status,
    isLive: false,
    title: undefined,
    liveCategory: undefined,
    viewerCount: undefined,
    startedAt: undefined,
  };
}

export default class BootstrapService {
  private readonly clock: () => Date;
  private readonly catalogCache: ShortTtlAsyncCache<HydratedCatalog>;
  private readonly liveStatusCache: ShortTtlAsyncCache<LiveStatus[]>;
  private readonly hubEventsSummaryCache: ShortTtlAsyncCache<HubEventsSummary>;

  constructor(private readonly dependencies: BootstrapServiceDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
    const now = () => this.clock().getTime();
    this.catalogCache = new ShortTtlAsyncCache({
      ttlMs: (dependencies.cacheTtlSeconds?.catalog ?? 30) * 1_000,
      now,
    });
    this.liveStatusCache = new ShortTtlAsyncCache({
      ttlMs: (dependencies.cacheTtlSeconds?.liveStatus ?? 10) * 1_000,
      now,
    });
    this.hubEventsSummaryCache = new ShortTtlAsyncCache({
      ttlMs: (dependencies.cacheTtlSeconds?.hubEventsSummary ?? 30) * 1_000,
      now,
    });
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
    const liveStatus = await this.liveStatusCache.getOrLoad(() =>
      this.dependencies.liveStatus.listDiagnostics(),
    );
    const catalog = await this.catalogCache.getOrLoad(async () => {
      const members = this.dependencies.catalog.getMembers().filter(isCatalogVisible);
      const hydratedMembers = this.dependencies.memberProfileImages
        ? await this.dependencies.memberProfileImages.hydrateMembers(members)
        : members;
      return {
        generations: this.dependencies.catalog.getGenerations(),
        members: hydratedMembers,
      };
    });
    const hubEventsSummary = await this.hubEventsSummaryCache.getOrLoad(() =>
      this.dependencies.hubEvents.summary(),
    );

    return {
      config: {
        unofficialProject: true,
        catalogVersion: "seed-2026-06-01",
        officialYoutubeLiveExcluded: true,
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
        generations: catalog.generations,
        members: catalog.members,
      },
      preferences,
      liveStatus: liveStatus.map(toMobileDisplayLiveStatus),
      hubEventsSummary,
      serverTime: this.clock().toISOString(),
    };
  }
}

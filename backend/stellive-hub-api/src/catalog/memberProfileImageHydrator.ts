import type { Prisma } from "@prisma/client";
import type { YoutubeDataApiClient, YoutubeChannelProfile } from "../adapters/youtube/youtubeDataApiClient.js";
import type { PlatformApiStateRecord } from "../repositories/platformApiStateRepository.js";
import type { Member } from "../../../../shared/schemas/domain.js";

const cacheSource = "youtube_channel_profile";
const defaultTtlMs = 24 * 60 * 60 * 1_000;
const defaultRefreshWaitMs = 1_500;

interface ProfileCacheValue {
  memberId?: string;
  title?: string;
  profileImageUrl?: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface MemberProfileImageStateRepository {
  getState(source: string, key: string): Promise<PlatformApiStateRecord | null>;
  upsertState(source: string, key: string, value: Prisma.InputJsonValue, status: string): Promise<unknown>;
}

export interface MemberProfileImageHydratorOptions {
  youtube?: Pick<YoutubeDataApiClient, "fetchChannelProfilesByIds">;
  stateRepository: MemberProfileImageStateRepository;
  ttlMs?: number;
  refreshWaitMs?: number;
  now?: () => Date;
}

export class MemberProfileImageHydrator {
  private readonly ttlMs: number;
  private readonly refreshWaitMs: number;
  private readonly now: () => Date;
  private refreshInFlight: Promise<void> | null = null;

  constructor(private readonly options: MemberProfileImageHydratorOptions) {
    this.ttlMs = options.ttlMs ?? defaultTtlMs;
    this.refreshWaitMs = options.refreshWaitMs ?? defaultRefreshWaitMs;
    this.now = options.now ?? (() => new Date());
  }

  async hydrateMembers(members: Member[]): Promise<Member[]> {
    const targets = members.flatMap((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      if (!channelId) return [];
      return [{ member, channelId }];
    });
    const cacheEntries = new Map<string, ProfileCacheValue>();
    const staleEntries = new Map<string, ProfileCacheValue>();
    const now = this.now();

    await Promise.all(targets.map(async ({ channelId }) => {
      const cached = toProfileCacheValue((await this.options.stateRepository.getState(cacheSource, channelId))?.value);
      if (!cached) return;
      if (new Date(cached.expiresAt).getTime() > now.getTime()) {
        cacheEntries.set(channelId, cached);
      } else {
        staleEntries.set(channelId, cached);
      }
    }));

    const missingOrExpiredIds = targets
      .map(({ channelId }) => channelId)
      .filter((channelId) => !cacheEntries.has(channelId));
    if (missingOrExpiredIds.length > 0) {
      await this.refreshProfiles(targets, missingOrExpiredIds, staleEntries);
      for (const channelId of missingOrExpiredIds) {
        const refreshed = toProfileCacheValue((await this.options.stateRepository.getState(cacheSource, channelId))?.value);
        const fallback = refreshed ?? staleEntries.get(channelId);
        if (fallback) cacheEntries.set(channelId, fallback);
      }
    }

    return members.map((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      const cached = channelId ? cacheEntries.get(channelId) : undefined;
      if (!cached?.profileImageUrl) return { ...member };
      return {
        ...member,
        profileImageUrl: cached.profileImageUrl,
        avatar: {
          ...member.avatar,
          preferredSource: "youtube_api",
          imageUrl: cached.profileImageUrl,
          sourcePlatform: "youtube",
          sourceProfileUrl: `https://www.youtube.com/channel/${channelId}`,
          fetchedAt: cached.fetchedAt,
          expiresAt: cached.expiresAt,
          licenseStatus: "platform_api_display_only",
        },
      };
    });
  }

  private async refreshProfiles(
    targets: Array<{ member: Member; channelId: string }>,
    channelIds: string[],
    staleEntries: Map<string, ProfileCacheValue>,
  ): Promise<void> {
    if (!this.options.youtube) return;
    if (this.refreshInFlight) return;

    const targetByChannelId = new Map(targets.map((target) => [target.channelId, target.member]));
    const refresh = (async () => {
      const result = await this.options.youtube?.fetchChannelProfilesByIds(channelIds);
      if (!result || result.status !== "ok") return;
      await Promise.all(result.profiles.map((profile) => {
        const member = targetByChannelId.get(profile.channelId);
        return this.writeProfileCache(profile, member?.id);
      }));
    })();
    this.refreshInFlight = refresh;

    try {
      await Promise.race([refresh, sleep(this.refreshWaitMs)]);
    } catch {
      // Stale cache remains usable when YouTube refresh fails.
    } finally {
      refresh.catch(() => undefined).finally(() => {
        this.refreshInFlight = null;
      });
    }

    for (const [channelId, cached] of staleEntries) {
      if (!channelIds.includes(channelId)) continue;
      await this.options.stateRepository.upsertState(cacheSource, channelId, cached as unknown as Prisma.InputJsonValue, "stale");
    }
  }

  private async writeProfileCache(profile: YoutubeChannelProfile, memberId?: string): Promise<void> {
    const fetchedAt = profile.fetchedAt;
    const expiresAt = new Date(this.now().getTime() + this.ttlMs).toISOString();
    const value: ProfileCacheValue = {
      memberId,
      title: profile.title,
      profileImageUrl: profile.profileImageUrl,
      fetchedAt,
      expiresAt,
    };
    await this.options.stateRepository.upsertState(cacheSource, profile.channelId, value as unknown as Prisma.InputJsonValue, "fresh");
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

function toProfileCacheValue(value: unknown): ProfileCacheValue | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const fetchedAt = typeof record.fetchedAt === "string" ? record.fetchedAt : undefined;
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : undefined;
  if (!fetchedAt || !expiresAt) return null;
  const profileImageUrl = typeof record.profileImageUrl === "string" && record.profileImageUrl.startsWith("https://")
    ? record.profileImageUrl
    : undefined;
  return {
    memberId: typeof record.memberId === "string" ? record.memberId : undefined,
    title: typeof record.title === "string" ? record.title : undefined,
    profileImageUrl,
    fetchedAt,
    expiresAt,
  };
}

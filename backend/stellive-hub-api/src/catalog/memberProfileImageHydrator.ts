import type { YoutubeDataApiClient, YoutubeChannelProfile } from "../adapters/youtube/youtubeDataApiClient.js";
import {
  isHttpsUrl,
  type ChannelImageCacheRecord,
  type ChannelImageCacheRepositoryPort,
} from "../repositories/channelImageCacheRepository.js";
import type { Member } from "../../../../shared/schemas/domain.js";

const defaultTtlMs = 7 * 24 * 60 * 60 * 1_000;
const defaultRefreshWaitMs = 1_500;

interface ProfileCacheValue {
  title?: string;
  profileImageUrl: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface MemberProfileImageHydratorOptions {
  youtube?: Pick<YoutubeDataApiClient, "fetchChannelProfilesByIds">;
  channelImageCache: ChannelImageCacheRepositoryPort;
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
    const channelIds = [...new Set(members.flatMap((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      return channelId ? [channelId] : [];
    }))];
    if (channelIds.length === 0) return members.map((member) => ({ ...member }));

    const now = this.now();
    const initialRecords = await this.options.channelImageCache.listByChannelIds("youtube", channelIds);
    const refreshIds = channelIds.filter((channelId) => this.shouldRefresh(initialRecords.get(channelId), now));

    if (refreshIds.length > 0) {
      await this.refreshProfiles(refreshIds);
    }

    const refreshedRecords = refreshIds.length > 0
      ? await this.options.channelImageCache.listByChannelIds("youtube", channelIds)
      : initialRecords;
    const cacheEntries = new Map<string, ProfileCacheValue>();
    for (const channelId of channelIds) {
      const value = this.toProfileCacheValue(refreshedRecords.get(channelId) ?? initialRecords.get(channelId));
      if (value) cacheEntries.set(channelId, value);
    }

    return members.map((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      const cached = channelId ? cacheEntries.get(channelId) : undefined;
      if (!channelId || !cached) return { ...member };
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

  private shouldRefresh(record: ChannelImageCacheRecord | undefined, now: Date): boolean {
    if (!record) return true;
    const nextRetryAt = parseDate(record.nextRetryAt);
    if (nextRetryAt && nextRetryAt.getTime() > now.getTime()) return false;
    const refreshedAt = parseDate(record.refreshedAt);
    const fresh = record.status === "fresh"
      && isHttpsUrl(record.imageUrl)
      && refreshedAt !== null
      && now.getTime() - refreshedAt.getTime() < this.ttlMs;
    return !fresh;
  }

  private toProfileCacheValue(record: ChannelImageCacheRecord | undefined): ProfileCacheValue | null {
    if (!record || !isHttpsUrl(record.imageUrl)) return null;
    const refreshedAt = parseDate(record.refreshedAt);
    if (!refreshedAt) return null;
    return {
      title: record.title,
      profileImageUrl: record.imageUrl,
      fetchedAt: refreshedAt.toISOString(),
      expiresAt: new Date(refreshedAt.getTime() + this.ttlMs).toISOString(),
    };
  }

  private async refreshProfiles(channelIds: string[]): Promise<void> {
    if (!this.options.youtube) return;
    if (!this.refreshInFlight) {
      const refresh = this.performRefresh(channelIds);
      this.refreshInFlight = refresh;
      refresh.finally(() => {
        if (this.refreshInFlight === refresh) this.refreshInFlight = null;
      }).catch(() => undefined);
    }
    await Promise.race([this.refreshInFlight, sleep(this.refreshWaitMs)]);
  }

  private async performRefresh(channelIds: string[]): Promise<void> {
    const now = this.now();
    try {
      const result = await this.options.youtube?.fetchChannelProfilesByIds(channelIds);
      if (!result || result.status !== "ok") {
        await this.markFailures(channelIds, `youtube_profile_${result?.status ?? "unavailable"}`, now);
        return;
      }

      const profileByChannelId = new Map(result.profiles.map((profile) => [profile.channelId, profile]));
      await Promise.all(channelIds.map(async (channelId) => {
        const profile = profileByChannelId.get(channelId);
        if (!profile) {
          await this.markFailure(channelId, "youtube_profile_missing", now);
          return;
        }
        if (!isHttpsUrl(profile.profileImageUrl)) {
          await this.markFailure(channelId, "youtube_profile_non_https", now);
          return;
        }
        await this.writeProfileCache({ ...profile, profileImageUrl: profile.profileImageUrl }, now);
      }));
    } catch {
      await this.markFailures(channelIds, "youtube_profile_refresh_failed", now);
    }
  }

  private async writeProfileCache(
    profile: YoutubeChannelProfile & { profileImageUrl: string },
    fallbackDate: Date,
  ): Promise<void> {
    const refreshedAt = parseDate(profile.fetchedAt) ?? fallbackDate;
    await this.options.channelImageCache.upsertSuccess({
      source: "youtube",
      channelId: profile.channelId,
      imageUrl: profile.profileImageUrl,
      title: profile.title,
      refreshedAt,
    });
  }

  private async markFailures(channelIds: string[], reason: string, now: Date): Promise<void> {
    await Promise.all(channelIds.map((channelId) => this.markFailure(channelId, reason, now)));
  }

  private async markFailure(channelId: string, reason: string, now: Date): Promise<void> {
    await this.options.channelImageCache.markMissingOrFailed({
      source: "youtube",
      channelId,
      reason,
      now,
      keepExistingUrl: true,
    });
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

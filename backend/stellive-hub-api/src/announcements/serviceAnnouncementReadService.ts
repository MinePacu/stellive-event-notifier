import type { ServiceAnnouncementPlatform } from "../../../../shared/schemas/domain.js";
import { ShortTtlAsyncCache } from "../utils/shortTtlAsyncCache.js";
import { ServiceAnnouncementRepository } from "./serviceAnnouncementRepository.js";
import { isValidAppVersion } from "./serviceAnnouncementTargetPolicy.js";

const MAX_SUMMARY_CACHE_ENTRIES = 256;

export class ServiceAnnouncementReadService {
  private readonly summaries = new Map<string, ShortTtlAsyncCache<Awaited<ReturnType<ServiceAnnouncementRepository["summary"]>>>>();

  constructor(
    private readonly repository = new ServiceAnnouncementRepository(),
    private readonly ttlMs = 30_000,
    private readonly maxEntries = MAX_SUMMARY_CACHE_ENTRIES,
  ) {}

  list(input: { platform?: ServiceAnnouncementPlatform; appVersion?: string; includeArchived?: boolean; cursor?: string; limit?: number }) {
    return this.repository.listPublic(input);
  }

  detail(id: string, input: { platform?: ServiceAnnouncementPlatform; appVersion?: string }) {
    return this.repository.getPublicById(id, input);
  }

  summary(input: { platform?: ServiceAnnouncementPlatform; appVersion?: string }) {
    // Bucket the cache key by validated app version so an untrusted client cannot grow the
    // cache without bound: unknown/malformed versions collapse to a single "invalid" bucket
    // (they all resolve identically to version_unknown targeting), and valid versions are
    // capped by an LRU-style eviction below. The raw input is still passed to the loader so
    // targeting behavior is unchanged.
    const versionKey =
      input.appVersion === undefined ? "all" : isValidAppVersion(input.appVersion) ? input.appVersion : "invalid";
    const key = `${input.platform ?? "all"}:${versionKey}`;
    let cache = this.summaries.get(key);
    if (!cache) {
      while (this.summaries.size >= this.maxEntries) {
        const oldest = this.summaries.keys().next().value;
        if (oldest === undefined) break;
        this.summaries.delete(oldest);
      }
      cache = new ShortTtlAsyncCache({ ttlMs: this.ttlMs });
      this.summaries.set(key, cache);
    }
    return cache.getOrLoad(() => this.repository.summary(input));
  }

  invalidate(): void {
    this.summaries.forEach((cache) => cache.clear());
    this.summaries.clear();
  }
}

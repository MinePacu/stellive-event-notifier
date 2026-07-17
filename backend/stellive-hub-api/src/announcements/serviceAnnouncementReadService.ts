import type { ServiceAnnouncementPlatform } from "../../../../shared/schemas/domain.js";
import { ShortTtlAsyncCache } from "../utils/shortTtlAsyncCache.js";
import { ServiceAnnouncementRepository } from "./serviceAnnouncementRepository.js";

export class ServiceAnnouncementReadService {
  private readonly summaries = new Map<string, ShortTtlAsyncCache<Awaited<ReturnType<ServiceAnnouncementRepository["summary"]>>>>();

  constructor(
    private readonly repository = new ServiceAnnouncementRepository(),
    private readonly ttlMs = 30_000,
  ) {}

  list(input: { platform?: ServiceAnnouncementPlatform; appVersion?: string; includeArchived?: boolean; cursor?: string; limit?: number }) {
    return this.repository.listPublic(input);
  }

  detail(id: string, input: { platform?: ServiceAnnouncementPlatform; appVersion?: string }) {
    return this.repository.getPublicById(id, input);
  }

  summary(input: { platform?: ServiceAnnouncementPlatform; appVersion?: string }) {
    const key = `${input.platform ?? "all"}:${input.appVersion ?? "all"}`;
    let cache = this.summaries.get(key);
    if (!cache) {
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

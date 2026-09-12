import type { MusicItemType } from "../../../../shared/schemas/domain.js";

export interface OfficialMusicSourceItem {
  youtubeVideoId: string;
  type: Exclude<MusicItemType, "unknown">;
  memberIds: string[];
}

export type MusicReconciliationDiagnostic =
  | { kind: "category_mismatch"; youtubeVideoId: string; expected: MusicItemType; actual: MusicItemType }
  | { kind: "member_mismatch"; youtubeVideoId: string; expected: string[]; actual: string[] }
  | { kind: "missing_in_db"; youtubeVideoId: string; expected: MusicItemType };

/** Minimal shape the reconciliation pass needs; deliberately not the public catalog DTO. */
export interface MusicReconciliationItem {
  youtubeVideoId: string;
  type: MusicItemType;
  memberIds: string[];
}

export interface MusicReconciliationRepository {
  /**
   * Must return every stored music item, without the public catalog's visibility filters.
   * Using the public listing here reported private/excluded/unreviewed rows that exist in
   * the DB as `missing_in_db`.
   */
  listAllMusicItemsForReconciliation(
    filters: { limit?: number; cursor?: string },
  ): Promise<{ items: MusicReconciliationItem[]; nextCursor?: string | null }>;
}

export class MusicReconciliationService {
  constructor(private readonly options: { repository: MusicReconciliationRepository }) {}

  async compareWithOfficialSource(sourceItems: OfficialMusicSourceItem[]): Promise<{
    checkedCount: number;
    diagnostics: MusicReconciliationDiagnostic[];
  }> {
    // Page through the entire catalog rather than only the first 100 items; otherwise every
    // source item beyond the newest 100 was falsely reported as missing_in_db.
    const byVideoId = new Map<string, MusicReconciliationItem>();
    let cursor: string | undefined;
    for (let guard = 0; guard < 1000; guard += 1) {
      const page = await this.options.repository.listAllMusicItemsForReconciliation({ limit: 200, cursor });
      for (const item of page.items) byVideoId.set(item.youtubeVideoId, item);
      cursor = page.nextCursor ?? undefined;
      if (!cursor) break;
    }
    const diagnostics: MusicReconciliationDiagnostic[] = [];

    for (const source of sourceItems) {
      const actual = byVideoId.get(source.youtubeVideoId);
      if (!actual) {
        diagnostics.push({ kind: "missing_in_db", youtubeVideoId: source.youtubeVideoId, expected: source.type });
        continue;
      }
      if (actual.type !== source.type) {
        diagnostics.push({
          kind: "category_mismatch",
          youtubeVideoId: source.youtubeVideoId,
          expected: source.type,
          actual: actual.type,
        });
      }
      const actualMemberIds = [...actual.memberIds].sort();
      const expectedMemberIds = [...source.memberIds].sort();
      if (actualMemberIds.join("|") !== expectedMemberIds.join("|")) {
        diagnostics.push({
          kind: "member_mismatch",
          youtubeVideoId: source.youtubeVideoId,
          expected: expectedMemberIds,
          actual: actualMemberIds,
        });
      }
    }

    return { checkedCount: sourceItems.length, diagnostics };
  }
}

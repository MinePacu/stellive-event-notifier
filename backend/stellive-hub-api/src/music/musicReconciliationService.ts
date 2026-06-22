import type { MusicCatalogItem, MusicItemType } from "../../../../shared/schemas/domain.js";

export interface OfficialMusicSourceItem {
  youtubeVideoId: string;
  type: Exclude<MusicItemType, "unknown">;
  memberIds: string[];
}

export type MusicReconciliationDiagnostic =
  | { kind: "category_mismatch"; youtubeVideoId: string; expected: MusicItemType; actual: MusicItemType }
  | { kind: "member_mismatch"; youtubeVideoId: string; expected: string[]; actual: string[] }
  | { kind: "missing_in_db"; youtubeVideoId: string; expected: MusicItemType };

export interface MusicReconciliationRepository {
  listMusicItems(filters: { type?: "all"; limit?: number }): Promise<{ items: MusicCatalogItem[]; nextCursor?: string | null }>;
}

export class MusicReconciliationService {
  constructor(private readonly options: { repository: MusicReconciliationRepository }) {}

  async compareWithOfficialSource(sourceItems: OfficialMusicSourceItem[]): Promise<{
    checkedCount: number;
    diagnostics: MusicReconciliationDiagnostic[];
  }> {
    const dbItems = await this.options.repository.listMusicItems({ type: "all", limit: 100 });
    const byVideoId = new Map(dbItems.items.map((item) => [item.youtubeVideoId, item]));
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
      const actualMemberIds = actual.members.map((member) => member.id).sort();
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

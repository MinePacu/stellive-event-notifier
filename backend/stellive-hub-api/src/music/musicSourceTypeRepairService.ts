import type { MusicItemType } from "../../../../shared/schemas/domain.js";
import type { MusicSourceTypeMismatchRecord, SourcePlaylistRawCategoryHint } from "../repositories/musicRepository.js";

interface SourceTypeRepairRepository {
  listSourceTypeMismatches(limit?: number): Promise<MusicSourceTypeMismatchRecord[]>;
  repairMusicItemSourceType(id: string, type: MusicItemType, rawCategoryHint: SourcePlaylistRawCategoryHint): Promise<void>;
}

export interface MusicSourceTypeRepairServiceOptions {
  repository: SourceTypeRepairRepository;
}

function isManualStatus(status: string | null | undefined): boolean {
  return status === "MANUAL_CONFIRMED" || status === "MANUAL_EXCLUDED";
}

export class MusicSourceTypeRepairService {
  constructor(private readonly options: MusicSourceTypeRepairServiceOptions) {}

  async repair(limit = 1000) {
    const rows = await this.options.repository.listSourceTypeMismatches(limit);
    const summary = {
      status: "ok" as const,
      checked: rows.length,
      repaired: 0,
      manualSkipped: 0,
    };

    for (const row of rows) {
      if (isManualStatus(row.classificationStatus)) {
        summary.manualSkipped += 1;
        continue;
      }
      const sourceType = row.sourcePlaylist?.type;
      const rawCategoryHint = row.sourcePlaylist?.rawCategoryHint;
      if (!sourceType || !rawCategoryHint) continue;
      await this.options.repository.repairMusicItemSourceType(row.id, sourceType, rawCategoryHint);
      summary.repaired += 1;
    }

    return summary;
  }
}

export default MusicSourceTypeRepairService;

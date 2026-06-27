import type { MusicItemType } from "../../../../shared/schemas/domain.js";
import { classifySongUpload } from "../songs/songClassifier.js";
import { classifyVideo } from "./musicClassifier.js";
import type {
  MusicItemClassificationUpdateInput,
  MusicItemReclassificationRecord,
} from "../repositories/musicRepository.js";

interface ReclassificationRepository {
  listDiscoveredMusicItemsForReclassification(limit?: number): Promise<MusicItemReclassificationRecord[]>;
  updateMusicItemClassification(id: string, input: MusicItemClassificationUpdateInput): Promise<void>;
}

export interface MusicChannelDiscoveryReclassificationServiceOptions {
  repository: ReclassificationRepository;
  now?: () => Date;
}

function stringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isManualStatus(status: string | null | undefined): boolean {
  return status === "MANUAL_CONFIRMED" || status === "MANUAL_EXCLUDED";
}

export class MusicChannelDiscoveryReclassificationService {
  constructor(private readonly options: MusicChannelDiscoveryReclassificationServiceOptions) {}

  async reclassify(limit = 1000) {
    const rows = await this.options.repository.listDiscoveredMusicItemsForReclassification(limit);
    const summary = {
      status: "ok" as const,
      checked: rows.length,
      hidden: 0,
      kept: 0,
      manualSkipped: 0,
    };

    for (const row of rows) {
      if (isManualStatus(row.classificationStatus)) {
        summary.manualSkipped += 1;
        continue;
      }

      const songClassification = classifySongUpload({
        title: row.title,
        description: row.description,
        tags: stringTags(row.tags),
      });
      if (songClassification.type !== "cover" && songClassification.type !== "original") {
        await this.options.repository.updateMusicItemClassification(row.id, {
          classificationStatus: "NEEDS_REVIEW",
          isExcluded: true,
          exclusionReason: "non_music_upload",
          rawCategoryHint: "UNKNOWN",
          fetchedAt: this.now(),
          lastSeenAt: this.now(),
        });
        summary.hidden += 1;
        continue;
      }

      const classification = classifyVideo({
        sourceTypes: [songClassification.type],
        title: row.title,
        description: row.description,
        duration: row.duration,
        privacyStatus: row.privacyStatus,
      });
      const update: MusicItemClassificationUpdateInput = {
        type: songClassification.type as MusicItemType,
        durationSeconds: classification.durationSeconds,
        isAvailable: classification.isAvailable,
        isExcluded: classification.isExcluded,
        exclusionReason: classification.exclusionReason,
        classificationStatus: classification.classificationStatus,
        isInstrumental: classification.isInstrumental,
        specialFlags: classification.specialFlags,
        rawCategoryHint: songClassification.type.toUpperCase(),
        fetchedAt: this.now(),
        lastSeenAt: this.now(),
      };
      await this.options.repository.updateMusicItemClassification(row.id, update);
      summary.kept += 1;
    }

    return summary;
  }

  private now(): Date {
    return (this.options.now ?? (() => new Date()))();
  }
}

export default MusicChannelDiscoveryReclassificationService;

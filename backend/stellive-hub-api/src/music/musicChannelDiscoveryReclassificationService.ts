import type { MusicItemType } from "../../../../shared/schemas/domain.js";
import { classifySongUpload, type SongBroadcastState } from "../songs/songClassifier.js";
import { classifyVideo } from "./musicClassifier.js";
import type { MusicMemberAliasInput } from "./musicMemberMatcher.js";
import type { MusicChannelDiscoveryTarget } from "./musicChannelDiscoverySyncService.js";
import {
  assessMusicOriginalTitleTrust,
  matchMusicOriginalTitle,
} from "./musicOriginalTitleMatcher.js";
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
  members: MusicMemberAliasInput[];
  targets: readonly MusicChannelDiscoveryTarget[];
  now?: () => Date;
}

function stringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isManualStatus(status: string | null | undefined): boolean {
  return status === "MANUAL_CONFIRMED" || status === "MANUAL_EXCLUDED";
}

function storedBroadcastState(row: MusicItemReclassificationRecord): SongBroadcastState {
  const state = row.youtubePremiereState;
  if (state === "scheduled" || state === "live" || state === "completed" || state === "unknown") return state;
  return row.youtubePresentationType === "regular" ? "none" : "unknown";
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

      const target = this.options.targets.find((candidate) => candidate.channelId === row.channelId);
      const structuredOriginal = matchMusicOriginalTitle(row.title, this.options.members);
      const structuredTrust = assessMusicOriginalTitleTrust(structuredOriginal, target);
      if (!target || !structuredTrust.shouldPersist) {
        await this.hide(row, "untrusted_channel", structuredTrust.specialFlags);
        summary.hidden += 1;
        continue;
      }

      const songClassification = classifySongUpload({
        title: row.title,
        description: row.description,
        tags: stringTags(row.tags),
        duration: row.duration,
        privacyStatus: row.privacyStatus,
        broadcastState: storedBroadcastState(row),
        isOfficialMemberChannel: target.kind === "member",
      });
      const keywordType = songClassification.reason !== "member_channel_playlist_compilation" &&
        (songClassification.type === "cover" || songClassification.type === "original")
        ? songClassification.type
        : null;
      const playlistCoverType = songClassification.reason === "member_channel_playlist_compilation"
        ? "cover"
        : null;
      const itemType = structuredOriginal.classification?.type
        ?? keywordType
        ?? playlistCoverType
        ?? "unknown";
      if (itemType === "unknown" && structuredOriginal.status !== "partial") {
        await this.hide(row, "non_music_upload", songClassification.specialFlags);
        summary.hidden += 1;
        continue;
      }

      const classification = classifyVideo({
        sourceTypes: [itemType],
        title: row.title,
        description: row.description,
        duration: row.duration,
        privacyStatus: row.privacyStatus,
        specialFlags: [
          ...structuredTrust.specialFlags,
          ...(songClassification.specialFlags ?? []),
        ],
      });
      const trustReview = structuredTrust.needsReview;
      const update: MusicItemClassificationUpdateInput = {
        type: itemType as MusicItemType,
        durationSeconds: classification.durationSeconds,
        isAvailable: classification.isAvailable,
        isExcluded: trustReview ? true : classification.isExcluded,
        exclusionReason: trustReview
          ? (classification.exclusionReason ?? structuredTrust.reason)
          : classification.exclusionReason,
        classificationStatus: trustReview ? "NEEDS_REVIEW" : classification.classificationStatus,
        isInstrumental: classification.isInstrumental,
        specialFlags: classification.specialFlags,
        rawCategoryHint: structuredOriginal.status === "partial" ? "UNKNOWN" : itemType.toUpperCase(),
        fetchedAt: this.now(),
        lastSeenAt: this.now(),
      };
      await this.options.repository.updateMusicItemClassification(row.id, update);
      if (update.classificationStatus === "NEEDS_REVIEW" && update.isExcluded) summary.hidden += 1;
      else summary.kept += 1;
    }

    return summary;
  }

  private now(): Date {
    return (this.options.now ?? (() => new Date()))();
  }

  private async hide(
    row: MusicItemReclassificationRecord,
    reason: string,
    specialFlags: string[] | null | undefined,
  ): Promise<void> {
    await this.options.repository.updateMusicItemClassification(row.id, {
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: reason,
      specialFlags: specialFlags ?? [],
      rawCategoryHint: "UNKNOWN",
      fetchedAt: this.now(),
      lastSeenAt: this.now(),
    });
  }
}

export default MusicChannelDiscoveryReclassificationService;

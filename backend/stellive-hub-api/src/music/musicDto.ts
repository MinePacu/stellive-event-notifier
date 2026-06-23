import type { MusicCatalogItem } from "../../../../shared/schemas/domain.js";

export function toMusicCatalogDto(item: MusicCatalogItem): MusicCatalogItem {
  return {
    id: item.id,
    youtubeVideoId: item.youtubeVideoId,
    title: item.title,
    type: item.type,
    publishedAt: item.publishedAt,
    thumbnailUrl: item.thumbnailUrl,
    duration: item.duration,
    durationSeconds: item.durationSeconds,
    isInstrumental: item.isInstrumental,
    specialFlags: item.specialFlags,
    classificationStatus: item.classificationStatus,
    members: item.members.map((member) => ({
      id: member.id,
      nameKo: member.nameKo,
      nameEn: member.nameEn,
      role: member.role,
    })),
    youtubeUrl: item.youtubeUrl || `https://www.youtube.com/watch?v=${item.youtubeVideoId}`,
    sourcePlaylistId: item.sourcePlaylistId,
  };
}

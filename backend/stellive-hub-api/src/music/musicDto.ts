import type { MusicCatalogDetail, MusicCatalogItem } from "../../../../shared/schemas/domain.js";

export interface MusicCatalogMemberMetadata {
  generationId: string;
  generationName: string;
  unitName: string;
}

export interface MusicCatalogDtoMapper {
  toMusicCatalogDto(item: MusicCatalogItem): MusicCatalogItem;
  toMusicCatalogDetailDto(item: MusicCatalogDetail): MusicCatalogDetail;
}

export function createMusicCatalogDtoMapper(
  memberMetadataById: ReadonlyMap<string, MusicCatalogMemberMetadata>,
): MusicCatalogDtoMapper {
  const toMusicCatalogDto = (item: MusicCatalogItem): MusicCatalogItem => {
    const members = item.members.map((member) => {
      const catalogMember = memberMetadataById.get(member.id);
      return {
        id: member.id,
        nameKo: member.nameKo,
        nameEn: member.nameEn,
        role: member.role,
        generationId: catalogMember?.generationId ?? null,
        generationName: catalogMember?.generationName ?? null,
        unitName: catalogMember?.unitName ?? null,
      };
    });
    const sharedGeneration = members.length > 0 &&
      members.every((member) => member.generationId !== null) &&
      members.every((member) => member.generationId === members[0]?.generationId)
      ? members[0]
      : undefined;

    return {
      id: item.id,
      youtubeVideoId: item.youtubeVideoId,
      title: item.title,
      type: item.type,
      publishedAt: item.publishedAt,
      catalogAddedAt: item.catalogAddedAt,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
      durationSeconds: item.durationSeconds,
      isInstrumental: item.isInstrumental,
      specialFlags: item.specialFlags,
      classificationStatus: item.classificationStatus,
      members,
      generationId: sharedGeneration?.generationId ?? null,
      generationName: sharedGeneration?.generationName ?? null,
      youtubeUrl: item.youtubeUrl || `https://www.youtube.com/watch?v=${item.youtubeVideoId}`,
      sourcePlaylistId: item.sourcePlaylistId,
      premiere: item.premiere,
    };
  };

  return {
    toMusicCatalogDto,
    toMusicCatalogDetailDto: (item) => ({
      ...toMusicCatalogDto(item),
      sourcePlaylists: item.sourcePlaylists,
    }),
  };
}

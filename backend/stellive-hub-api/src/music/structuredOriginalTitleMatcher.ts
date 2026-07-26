export {
  assessMusicOriginalTitleTrust,
  matchMusicOriginalTitle as matchStructuredOriginalTitle,
  normalizeMusicOriginalTitle as normalizeStructuredOriginalTitle,
} from "./musicOriginalTitleMatcher.js";

export type {
  MusicOriginalTitleMember as StructuredOriginalMember,
  MusicOriginalTitleMatch as StructuredOriginalTitleMatch,
  MusicOriginalTitleMatchStatus as StructuredOriginalTitleMatchStatus,
} from "./musicOriginalTitleMatcher.js";

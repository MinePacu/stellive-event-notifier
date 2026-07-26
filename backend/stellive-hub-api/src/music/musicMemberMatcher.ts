import type { MusicMemberRole } from "../../../../shared/schemas/domain.js";
import {
  matchMusicOriginalTitle,
  type MusicOriginalTitleMember,
  type MusicOriginalTitleMatch,
} from "./musicOriginalTitleMatcher.js";

export type MusicMemberMatchSource =
  | "CHANNEL_ID"
  | "TITLE"
  | "DESCRIPTION"
  | "CHANNEL_TITLE"
  | "GROUP_ALIAS"
  | "STRUCTURED_TITLE"
  | "MANUAL"
  | "UNKNOWN";

export interface MusicMemberAliasInput extends MusicOriginalTitleMember {
  id: string;
  aliases: string[];
  youtubeChannelId?: string | null;
}

export interface MusicMemberMatchInput {
  sourceMemberId?: string | null;
  channelId?: string | null;
  title: string;
  description?: string | null;
  channelTitle?: string | null;
  members: MusicMemberAliasInput[];
  structuredOriginal?: MusicOriginalTitleMatch;
}

export interface MusicMemberMatchLink {
  memberId: string;
  role: MusicMemberRole;
  confidence: number;
  source: MusicMemberMatchSource;
}

export interface MusicMemberMatchResult {
  links: MusicMemberMatchLink[];
  diagnostics: string[];
}

const stelliveGroupAliases = ["stellive", "스텔라이브"];

export function matchMusicMembers(input: MusicMemberMatchInput): MusicMemberMatchResult {
  const structured = input.structuredOriginal ??
    matchMusicOriginalTitle(input.title, input.members);
  if (structured.exact) {
    return {
      links: structured.memberIds.map((memberId) => ({
        memberId,
        role: structured.kind === "member" ? "main" : "group",
        confidence: 0.95,
        source: "STRUCTURED_TITLE",
      })),
      diagnostics: [`${structured.status}/${structured.kind}`],
    };
  }

  const links = new Map<string, Omit<MusicMemberMatchLink, "role">>();
  const addMember = (
    memberId: string | null | undefined,
    confidence: number,
    source: MusicMemberMatchSource,
  ) => {
    if (!memberId || links.has(memberId)) return;
    links.set(memberId, { memberId, confidence, source });
  };

  const channelId = input.channelId?.trim();
  if (channelId) {
    const member = input.members.find((candidate) => candidate.youtubeChannelId === channelId);
    addMember(member?.id, 1, "CHANNEL_ID");
  }

  addMember(input.sourceMemberId, 0.9, "TITLE");
  matchAliases(input.title, input.members).forEach((memberId) => addMember(memberId, 0.8, "TITLE"));
  matchAliases(input.description ?? "", input.members).forEach((memberId) => addMember(memberId, 0.65, "DESCRIPTION"));
  matchAliases(input.channelTitle ?? "", input.members).forEach((memberId) => addMember(memberId, 0.55, "CHANNEL_TITLE"));

  const diagnostics: string[] = structured.partial
    ? [`${structured.status}/${structured.reason ?? "unknown"}`]
    : [];
  const fallbackGroupMembers = matchFallbackGroupMembers(
    input.title,
    input.description,
    input.members,
  );
  if (!structured.partial && links.size === 0 && fallbackGroupMembers.length > 0) {
    diagnostics.push("group_alias_match");
    fallbackGroupMembers.forEach((member) => addMember(member.id, 0.4, "GROUP_ALIAS"));
  }

  if (links.size === 0) return { links: [], diagnostics: [...diagnostics, "no_member_match"] };

  const group = links.size >= 3 || [...links.values()].some((link) => link.source === "GROUP_ALIAS");
  return {
    links: [...links.values()].map((link, index) => ({
      ...link,
      role: group ? "group" : roleForIndex(index),
    })),
    diagnostics,
  };
}

function matchAliases(text: string, members: MusicMemberAliasInput[]): string[] {
  const haystack = normalizeText(text);
  if (!haystack) return [];
  return members
    .filter((member) => member.aliases.some((alias) => alias.trim() && haystack.includes(normalizeText(alias))))
    .map((member) => member.id);
}

function matchFallbackGroupMembers(
  title: string,
  description: string | null | undefined,
  members: MusicMemberAliasInput[],
): MusicMemberAliasInput[] {
  const haystack = normalizeText(`${title}\n${description ?? ""}`);
  const matchedUnits = new Set(
    members
      .map((member) => member.unitName?.trim())
      .filter((unitName): unitName is string => Boolean(unitName))
      .filter((unitName) => haystack.includes(normalizeText(unitName)))
      .map(normalizeText),
  );
  if (matchedUnits.size > 0) {
    return members.filter((member) =>
      member.unitName && matchedUnits.has(normalizeText(member.unitName))
    );
  }
  return stelliveGroupAliases.some((alias) => haystack.includes(normalizeText(alias)))
    ? members
    : [];
}

function roleForIndex(index: number): MusicMemberRole {
  return index === 0 ? "main" : "collaboration";
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("ko-KR");
}

import type { MusicMemberRole } from "../../../../shared/schemas/domain.js";

export type MusicMemberMatchSource =
  | "CHANNEL_ID"
  | "TITLE"
  | "DESCRIPTION"
  | "CHANNEL_TITLE"
  | "GROUP_ALIAS"
  | "MANUAL"
  | "UNKNOWN";

export interface MusicMemberAliasInput {
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

const groupAliases = ["stellive", "스텔라이브", "universe", "cliche", "cliché", "mystic", "everys"];

export function matchMusicMembers(input: MusicMemberMatchInput): MusicMemberMatchResult {
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

  const diagnostics: string[] = [];
  if (links.size === 0 && hasGroupAlias(input.title, input.description)) {
    diagnostics.push("group_alias_match");
    input.members.forEach((member) => addMember(member.id, 0.4, "GROUP_ALIAS"));
  }

  if (links.size === 0) return { links: [], diagnostics: ["no_member_match"] };

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

function hasGroupAlias(title: string, description: string | null | undefined): boolean {
  const haystack = normalizeText(`${title}\n${description ?? ""}`);
  return groupAliases.some((alias) => haystack.includes(normalizeText(alias)));
}

function roleForIndex(index: number): MusicMemberRole {
  return index === 0 ? "main" : "collaboration";
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("ko-KR");
}

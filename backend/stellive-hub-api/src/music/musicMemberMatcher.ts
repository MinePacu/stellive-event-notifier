import type { MusicMemberRole } from "../../../../shared/schemas/domain.js";

export interface MusicMemberAliasInput {
  id: string;
  aliases: string[];
}

export interface MusicMemberMatchInput {
  sourceMemberId?: string | null;
  title: string;
  description?: string | null;
  members: MusicMemberAliasInput[];
}

export interface MusicMemberMatchLink {
  memberId: string;
  role: MusicMemberRole;
}

export interface MusicMemberMatchResult {
  links: MusicMemberMatchLink[];
  diagnostics: string[];
}

export function matchMusicMembers(input: MusicMemberMatchInput): MusicMemberMatchResult {
  const orderedMemberIds: string[] = [];
  const addMember = (memberId: string | null | undefined) => {
    if (memberId && !orderedMemberIds.includes(memberId)) orderedMemberIds.push(memberId);
  };

  addMember(input.sourceMemberId);
  const haystack = normalizeText(`${input.title}\n${input.description ?? ""}`);
  for (const member of input.members) {
    if (member.id === input.sourceMemberId) continue;
    if (member.aliases.some((alias) => alias.trim() && haystack.includes(normalizeText(alias)))) {
      addMember(member.id);
    }
  }

  if (orderedMemberIds.length === 0) {
    return { links: [], diagnostics: ["no_member_match"] };
  }

  const group = orderedMemberIds.length >= 3;
  return {
    links: orderedMemberIds.map((memberId, index) => ({
      memberId,
      role: group ? "group" : roleForIndex(index),
    })),
    diagnostics: [],
  };
}

function roleForIndex(index: number): MusicMemberRole {
  return index === 0 ? "main" : "collaboration";
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("ko-KR");
}

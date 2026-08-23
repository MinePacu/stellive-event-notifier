import type { Member } from "../../types.js";
import type { YoutubeWebSubSubscriptionTarget } from "./youtubeWebSubSubscriptionService.js";

const supportedMemberGenerations = new Set(["gen1", "gen2", "gen3"]);

export interface YoutubeWebSubTargetDiagnostic {
  code: "youtube_websub_target_duplicate_channel";
  channelId: string;
  memberIds: string[];
}

export interface YoutubeWebSubTargetResolver {
  resolve(channelId: string): YoutubeWebSubSubscriptionTarget | undefined;
}

export interface YoutubeWebSubTargetBuildResult {
  targets: YoutubeWebSubSubscriptionTarget[];
  diagnostics: YoutubeWebSubTargetDiagnostic[];
}

function isEligibleMember(member: Member, includeOfficial: boolean): boolean {
  if (member.activeStatus !== "active" && member.activeStatus !== "upcoming") return false;
  if (member.catalogRole === "official_channel") {
    return includeOfficial && member.supportedEventTypes?.includes("official_youtube_upload") === true;
  }
  return member.catalogRole === "member" && supportedMemberGenerations.has(member.generationId);
}

function topicUrl(channelId: string): string {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
}

export function buildYoutubeWebSubTargets(
  members: Member[],
  options: { includeOfficial?: boolean } = {},
): YoutubeWebSubTargetBuildResult {
  const includeOfficial = options.includeOfficial ?? true;
  const byChannel = new Map<string, Member[]>();

  for (const member of members) {
    if (!isEligibleMember(member, includeOfficial)) continue;
    const channelId = member.platforms.youtubeChannelId?.trim();
    if (!channelId) continue;
    const bucket = byChannel.get(channelId) ?? [];
    bucket.push(member);
    byChannel.set(channelId, bucket);
  }

  const diagnostics: YoutubeWebSubTargetDiagnostic[] = [];
  const targets: YoutubeWebSubSubscriptionTarget[] = [];
  for (const [channelId, channelMembers] of byChannel) {
    if (channelMembers.length !== 1) {
      diagnostics.push({
        code: "youtube_websub_target_duplicate_channel",
        channelId,
        memberIds: channelMembers.map((member) => member.id).sort(),
      });
      continue;
    }
    targets.push({
      targetId: channelMembers[0].id,
      channelId,
      topicUrl: topicUrl(channelId),
    });
  }

  return { targets, diagnostics };
}

export function createYoutubeWebSubTargetResolver(
  build: YoutubeWebSubTargetBuildResult,
): YoutubeWebSubTargetResolver {
  const byChannel = new Map(build.targets.map((target) => [target.channelId, target]));
  return {
    resolve(channelId) {
      return byChannel.get(channelId);
    },
  };
}

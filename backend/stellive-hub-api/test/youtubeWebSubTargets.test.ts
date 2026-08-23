import { describe, expect, it } from "vitest";
import { buildYoutubeWebSubTargets, createYoutubeWebSubTargetResolver } from "../src/adapters/youtube/youtubeWebSubTargets.js";
import type { Member } from "../src/types.js";

function member(input: Partial<Member>): Member {
  return {
    id: "member",
    koreanName: "멤버",
    englishName: "Member",
    generationId: "gen1",
    generationName: "1기생",
    unitName: "Everys",
    catalogRole: "member",
    activeStatus: "active",
    isPerson: true,
    avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
    platforms: { youtubeChannelId: "UC_MEMBER", externalUrls: {} },
    ...input,
  };
}

describe("buildYoutubeWebSubTargets", () => {
  it("includes gen1-3 and official targets while excluding representative and upcoming placeholders", () => {
    const result = buildYoutubeWebSubTargets([
      member({ id: "gen1-member", generationId: "gen1", platforms: { youtubeChannelId: "UC_GEN1", externalUrls: {} } }),
      member({ id: "gen2-member", generationId: "gen2", platforms: { youtubeChannelId: "UC_GEN2", externalUrls: {} } }),
      member({ id: "gen3-member", generationId: "gen3", platforms: { youtubeChannelId: "UC_GEN3", externalUrls: {} } }),
      member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] }),
      member({ id: "gamja", generationId: "gamja", catalogRole: "representative", platforms: { youtubeChannelId: "UC_GAMJA", externalUrls: {} } }),
      member({ id: "gen4", generationId: "gen4-upcoming", catalogRole: "placeholder", activeStatus: "upcoming", platforms: { youtubeChannelId: "UC_GEN4", externalUrls: {} } }),
    ]);

    expect(result.targets.map((target) => target.targetId)).toEqual(["gen1-member", "gen2-member", "gen3-member", "official"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("fails closed when channel IDs collide and resolver does not return either target", () => {
    const result = buildYoutubeWebSubTargets([
      member({ id: "first", platforms: { youtubeChannelId: "UC_DUP", externalUrls: {} } }),
      member({ id: "second", generationId: "gen2", platforms: { youtubeChannelId: "UC_DUP", externalUrls: {} } }),
    ]);

    expect(result.targets).toEqual([]);
    expect(result.diagnostics).toEqual([{
      code: "youtube_websub_target_duplicate_channel",
      channelId: "UC_DUP",
      memberIds: ["first", "second"],
    }]);
    expect(createYoutubeWebSubTargetResolver(result).resolve("UC_DUP")).toBeUndefined();
  });

  it("can disable official targets when the Data API key is unavailable", () => {
    const result = buildYoutubeWebSubTargets([
      member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] }),
    ], { includeOfficial: false });

    expect(result.targets).toEqual([]);
  });
});

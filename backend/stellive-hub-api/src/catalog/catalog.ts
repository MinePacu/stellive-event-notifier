import generationsSeed from "../../../../shared/member-catalog/generations.seed.json" with { type: "json" };
import membersSeed from "../../../../shared/member-catalog/members.seed.json" with { type: "json" };
import type { Generation, Member, PlatformEventType } from "../types.js";

const blockedOfficialYoutubeLiveEvents = new Set<string>([
  "official_youtube_live_scheduled",
  "official_youtube_live_started",
  "official_youtube_live_ended",
  "youtube_live_scheduled",
  "youtube_live_started",
  "youtube_live_ended"
]);

export class CatalogService {
  getGenerations(): Generation[] {
    return generationsSeed as Generation[];
  }

  getMembers(): Member[] {
    return (membersSeed as Member[]).filter((member) => member.activeStatus === "active" || member.activeStatus === "upcoming");
  }

  getMember(id: string): Member | undefined {
    return this.getMembers().find((member) => member.id === id);
  }

  isSupportedEventForMember(memberId: string, eventType: string): boolean {
    const member = this.getMember(memberId);
    if (!member) return false;
    if (member.id === "stellive-official" && blockedOfficialYoutubeLiveEvents.has(eventType)) return false;
    if (member.supportedEventTypes?.length) {
      return member.supportedEventTypes.includes(eventType as PlatformEventType);
    }
    return true;
  }

  assertNoFormerMembers(): boolean {
    return this.getMembers().every((member) => member.activeStatus === "active" || member.activeStatus === "upcoming");
  }
}


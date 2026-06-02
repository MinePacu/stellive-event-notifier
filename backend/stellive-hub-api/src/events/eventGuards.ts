import type { PlatformEvent } from "../types.js";

const officialYoutubeLiveTypes = new Set([
  "official_youtube_live_scheduled",
  "official_youtube_live_started",
  "official_youtube_live_ended",
  "youtube_live_scheduled",
  "youtube_live_started",
  "youtube_live_ended"
]);

export function shouldDropEventBeforeStorage(event: PlatformEvent): boolean {
  return event.memberId === "stellive-official" && officialYoutubeLiveTypes.has(event.type);
}

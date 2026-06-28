export interface YoutubeUploadCandidate {
  videoId: string;
  channelId: string;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  duration?: string;
  privacyStatus?: string;
  description?: string;
  tags?: string[];
  channelTitle?: string;
  liveBroadcastContent?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

export type YoutubeAtomParseResult =
  | { ok: true; entries: YoutubeUploadCandidate[] }
  | { ok: false; error: "missing_youtube_identifiers" | "invalid_youtube_atom" };

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return pattern.exec(value)?.[1]?.trim();
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseEntry(entry: string): YoutubeUploadCandidate | undefined {
  const videoId = firstMatch(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
  const channelId = firstMatch(entry, /<yt:channelId>([^<]+)<\/yt:channelId>/);
  if (!videoId || !channelId) return undefined;

  const title = firstMatch(entry, /<title>([^<]*)<\/title>/) ?? "";
  const sourceUrl = firstMatch(entry, /<link[^>]+href="([^"]+)"/) ?? `https://www.youtube.com/watch?v=${videoId}`;
  const publishedAt = normalizeDate(firstMatch(entry, /<published>([^<]+)<\/published>/)) ?? new Date(0).toISOString();
  const updatedAt = normalizeDate(firstMatch(entry, /<updated>([^<]+)<\/updated>/)) ?? publishedAt;

  return { videoId, channelId, title, sourceUrl, publishedAt, updatedAt };
}

export function parseYoutubeAtomFeed(feed: string): YoutubeAtomParseResult {
  const entries = [...feed.matchAll(/<entry[\s\S]*?<\/entry>/g)].map((match) => match[0]);
  if (entries.length === 0) return { ok: false, error: "invalid_youtube_atom" };

  const parsed = entries.map(parseEntry);
  if (parsed.some((entry) => entry === undefined)) return { ok: false, error: "missing_youtube_identifiers" };

  return { ok: true, entries: parsed as YoutubeUploadCandidate[] };
}

import { describe, expect, it } from "vitest";
import { parseYoutubeAtomFeed } from "../src/adapters/youtube/youtubeAtomParser.js";

const uploadFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UC123</yt:channelId>
    <title>별빛 항로</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-06-21T12:00:00+00:00</published>
    <updated>2026-06-21T12:01:00+00:00</updated>
  </entry>
</feed>`;

describe("YouTube Atom parser", () => {
  it("extracts only minimal upload candidate fields", () => {
    expect(parseYoutubeAtomFeed(uploadFeed)).toEqual({
      ok: true,
      entries: [
        {
          videoId: "abc123",
          channelId: "UC123",
          title: "별빛 항로",
          sourceUrl: "https://www.youtube.com/watch?v=abc123",
          publishedAt: "2026-06-21T12:00:00.000Z",
          updatedAt: "2026-06-21T12:01:00.000Z",
        },
      ],
    });
  });

  it("returns a typed parse error when required identifiers are missing", () => {
    expect(parseYoutubeAtomFeed("<feed><entry><title>missing ids</title></entry></feed>")).toEqual({
      ok: false,
      error: "missing_youtube_identifiers",
    });
  });
});

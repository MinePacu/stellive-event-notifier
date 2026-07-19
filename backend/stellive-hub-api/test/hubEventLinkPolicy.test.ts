import { describe, expect, it } from "vitest";
import {
  firstEventLegacyProjection,
  firstScheduleLegacyProjection,
  normalizeHubEventLinks,
  resolvedEventLinks,
  resolvedScheduleLinks
} from "../src/hub-events/hubEventLinkPolicy.js";

describe("hub event link policy", () => {
  it("prefers normalized links, filters unsafe URLs, deduplicates, and sorts deterministically", () => {
    const links = resolvedEventLinks({
      id: "event-1",
      sourceUrl: "https://legacy.example/source",
      sourceLabel: "Legacy",
      links: [
        { id: "b", kind: "ticket", url: "https://example.com/ticket", sortOrder: 1 },
        { id: "a", kind: "purchase", url: " https://example.com/shop ", sortOrder: 0 },
        { id: "c", kind: "custom", label: "Unsafe", url: "http://example.com", sortOrder: 2 },
        { id: "d", kind: "custom", label: "Duplicate", url: "https://example.com/shop", sortOrder: 3 }
      ]
    });
    expect(links.map((link) => link.id)).toEqual(["a", "b"]);
    expect(links[0]?.url).toBe("https://example.com/shop");
  });

  it("falls back to legacy parent and schedule URLs when arrays are absent", () => {
    expect(resolvedEventLinks({
      id: "event-1",
      sourceUrl: "https://example.com/source",
      sourceLabel: "Official",
      purchaseUrl: "https://example.com/shop",
      ticketUrl: "https://example.com/ticket"
    }).map((link) => link.kind)).toEqual(["purchase", "ticket", "source"]);

    expect(resolvedScheduleLinks({
      id: "schedule-1",
      kind: "ticket_open",
      actionUrl: "https://example.com/reserve",
      sourceUrl: "https://example.com/notice",
      sourceLabel: "Notice"
    }).map((link) => link.kind)).toEqual(["ticket", "source"]);
  });

  it("normalizes write values and projects legacy fields without clearing missing kinds", () => {
    const normalized = normalizeHubEventLinks([
      { kind: "purchase", label: "  Store  ", url: " https://example.com/store ", sortOrder: 0 }
    ]);
    expect(normalized).toEqual([
      { kind: "purchase", label: "Store", url: "https://example.com/store", sortOrder: 0 }
    ]);
    expect(firstEventLegacyProjection(normalized)).toEqual({
      purchaseUrl: "https://example.com/store",
      ticketUrl: undefined
    });
    expect(firstScheduleLegacyProjection([
      { kind: "source", label: "Notice", url: "https://example.com/notice", sortOrder: 1 },
      { kind: "content", url: "https://example.com/content", sortOrder: 0 }
    ])).toEqual({
      actionUrl: "https://example.com/content",
      sourceUrl: "https://example.com/notice",
      sourceLabel: "Notice"
    });
  });
});

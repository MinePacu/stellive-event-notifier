import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import { validateHubEvent } from "../src/hub-events/hubEventPolicy.js";
import type { HubEvent, HubEventCategory, HubEventStatus } from "../src/types.js";

describe("HubEvent types", () => {
  it("supports official online_goods events without image fields", () => {
    const category: HubEventCategory = "online_goods";
    const status: HubEventStatus = "announced";

    const event: HubEvent = {
      id: "hub-event-1",
      category,
      participationMode: "online",
      status,
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    };

    expect(event.category).toBe("online_goods");
    expect("imageUrl" in event).toBe(false);
    expect("logoUrl" in event).toBe(false);
    expect("posterUrl" in event).toBe(false);
  });
});

describe("validateHubEvent", () => {
  const catalog = new CatalogService();

  function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
    return {
      id: "hub-event-1",
      category: "online_goods",
      participationMode: "online",
      status: "announced",
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      ...overrides
    };
  }

  it("accepts official project events without member id", () => {
    expect(validateHubEvent(hubEvent(), catalog)).toEqual({ valid: true });
  });

  it("rejects excluded gangzi and gamja hub events", () => {
    expect(validateHubEvent(hubEvent({ memberId: "gangzi", generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gangzi_representative_excluded"
    });
    expect(validateHubEvent(hubEvent({ generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gamja_scope_excluded"
    });
  });

  it("rejects invalid source fields", () => {
    expect(validateHubEvent(hubEvent({ sourceUrl: "" }), catalog)).toEqual({
      valid: false,
      reason: "source_required"
    });
    expect(validateHubEvent(hubEvent({ sourceLabel: "" }), catalog)).toEqual({
      valid: false,
      reason: "source_required"
    });
    expect(validateHubEvent(hubEvent({ sourceType: "fan" as HubEvent["sourceType"] }), catalog)).toEqual({
      valid: false,
      reason: "source_type_not_allowed"
    });
  });

  it("rejects unknown members and generation mismatches", () => {
    expect(validateHubEvent(hubEvent({ memberId: "unknown-member", sourceType: "member" }), catalog)).toEqual({
      valid: false,
      reason: "member_not_allowed"
    });
    expect(validateHubEvent(hubEvent({ memberId: "tenko-shibuki", generationId: "gen2", sourceType: "member" }), catalog)).toEqual({
      valid: false,
      reason: "member_generation_mismatch"
    });
  });

  it("rejects untrusted asset fields", () => {
    expect(validateHubEvent({ ...hubEvent(), imageUrl: "https://example.com/image.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), logoUrl: "https://example.com/logo.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), posterUrl: "https://example.com/poster.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), thumbnailUrl: "https://example.com/thumb.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), profileImageUrl: "https://example.com/profile.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
  });
});

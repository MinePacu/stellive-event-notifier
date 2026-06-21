import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import { canDisplayHubEventImage, validateHubEventForAdmin } from "../src/hub-events/hubEventPolicy.js";
import type { HubEvent, HubEventImagePolicyState } from "../src/types.js";

const states: HubEventImagePolicyState[] = [
  "none",
  "official_runtime_url",
  "third_party_allowed",
  "verify_required",
  "blocked"
];

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "image-policy-event",
    category: "online_goods",
    participationMode: "online",
    status: "announced",
    title: "공식 굿즈",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "공식 공지",
    sourceType: "official",
    notificationEligible: true,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

function adminInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "image-policy-event",
    category: "online_goods",
    participationMode: "online",
    status: "announced",
    title: "공식 굿즈",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "공식 공지",
    sourceType: "official",
    announcedAt: "2026-06-12T00:00:00.000Z",
    notificationEligible: true,
    ...overrides
  };
}

const catalog = new CatalogService();

describe("HubEvent image policy", () => {
  it("defines the allowed image policy states", () => {
    expect(states).toEqual([
      "none",
      "official_runtime_url",
      "third_party_allowed",
      "verify_required",
      "blocked"
    ]);
  });

  it("allows HubEvents to omit image metadata", () => {
    expect(hubEvent().image).toBeUndefined();
  });

  it("allows official runtime image metadata on HubEvent", () => {
    const event = hubEvent({
      image: {
        policyState: "official_runtime_url",
        url: "https://example.com/event.jpg",
        sourceLabel: "공식 공지",
        sourceUrl: "https://example.com/notice",
        altText: "공식 굿즈 이미지"
      }
    });

    expect(event.image?.policyState).toBe("official_runtime_url");
  });

  it.each([
    [
      "official_runtime_url",
      "https://example.com/event.jpg",
      true
    ],
    ["third_party_allowed", "https://example.com/event.jpg", true],
    ["none", "https://example.com/event.jpg", false],
    ["verify_required", "https://example.com/event.jpg", false],
    ["blocked", "https://example.com/event.jpg", false],
    ["official_runtime_url", "http://example.com/event.jpg", false],
    ["official_runtime_url", undefined, false]
  ] as Array<[HubEventImagePolicyState, string | undefined, boolean]>)(
    "returns %s display eligibility for %s",
    (policyState, url, expected) => {
      expect(canDisplayHubEventImage({ policyState, url })).toBe(expected);
    }
  );

  it("accepts metadata-only official runtime images in admin validation", () => {
    const result = validateHubEventForAdmin(
      adminInput({
        image: {
          policyState: "official_runtime_url",
          url: "https://example.com/event.jpg",
          sourceLabel: "공식 공지",
          sourceUrl: "https://example.com/notice"
        }
      }),
      catalog,
      "draft"
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [{ policyState: "official_runtime_url", sourceLabel: "공식 공지", sourceUrl: "https://example.com/notice" }, "image_url_not_https"],
    [{ policyState: "official_runtime_url", url: "https://example.com/event.jpg", sourceUrl: "https://example.com/notice" }, "image_source_required"],
    [{ policyState: "official_runtime_url", url: "https://example.com/event.jpg", sourceLabel: "공식 공지" }, "image_source_required"],
    [{ policyState: "official_runtime_url", url: "http://example.com/event.jpg", sourceLabel: "공식 공지", sourceUrl: "https://example.com/notice" }, "image_url_not_https"],
    [{ policyState: "unknown", url: "https://example.com/event.jpg", sourceLabel: "공식 공지", sourceUrl: "https://example.com/notice" }, "image_policy_state_not_allowed"],
    [{ policyState: "blocked", bytes: "abc" }, "image_asset_fields_not_allowed"],
    [{ policyState: "blocked", base64: "abc" }, "image_asset_fields_not_allowed"],
    [{ policyState: "blocked", assetPath: "/tmp/event.jpg" }, "image_asset_fields_not_allowed"],
    [{ policyState: "blocked", filePath: "/tmp/event.jpg" }, "image_asset_fields_not_allowed"],
    [{ policyState: "blocked", localPath: "/tmp/event.jpg" }, "image_asset_fields_not_allowed"]
  ])("rejects invalid admin image metadata %#", (image, reason) => {
    const result = validateHubEventForAdmin(adminInput({ image }), catalog, "draft");

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ reason })]));
  });

  it.each([
    { policyState: "none", url: "https://example.com/event.jpg" },
    { policyState: "none", sourceLabel: "공식 공지" },
    { policyState: "none", sourceUrl: "https://example.com/notice" },
  ])("rejects none image policy with filled image metadata %#", (image) => {
    const result = validateHubEventForAdmin(adminInput({ image }), catalog, "draft");

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "image_policy_state_not_allowed" })])
    );
  });

  it.each(["verify_required", "blocked"] as HubEventImagePolicyState[])(
    "accepts %s review metadata without making it displayable",
    (policyState) => {
      const image = {
        policyState,
        url: "https://example.com/event.jpg",
        sourceLabel: "공식 공지",
        sourceUrl: "https://example.com/notice"
      };
      const result = validateHubEventForAdmin(adminInput({ image }), catalog, "draft");

      expect(result).toEqual({ valid: true, errors: [] });
      expect(canDisplayHubEventImage(image)).toBe(false);
    }
  );

  it.each(["none", "verify_required", "blocked"] as HubEventImagePolicyState[])(
    "accepts %s without display URL metadata",
    (policyState) => {
      const result = validateHubEventForAdmin(adminInput({ image: { policyState } }), catalog, "draft");

      expect(result).toEqual({ valid: true, errors: [] });
    }
  );
});

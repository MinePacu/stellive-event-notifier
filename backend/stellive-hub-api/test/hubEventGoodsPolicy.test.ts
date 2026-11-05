import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import {
  countActiveGoodsItems,
  toPublicGoodsItems,
  validateHubEventGoodsItem,
  validateHubEventGoodsItems,
  withGoodsCountOnly,
  withPublicGoodsItems
} from "../src/hub-events/hubEventGoodsPolicy.js";
import type { HubEventValidationError } from "../src/hub-events/hubEventAdminTypes.js";
import type { HubEvent, HubEventGoodsItem } from "../src/types.js";

const context = { catalog: new CatalogService(), scheduleItemIds: new Set(["schedule-1"]) };

function validItem(overrides: Record<string, unknown> = {}) {
  return {
    name: "  아크릴 스탠드  ",
    groupLabel: "아크릴",
    memberIds: ["tenko-shibuki"],
    priceKrw: 12000,
    salesChannel: "both",
    purchaseLimit: 3,
    isBonus: false,
    purchaseUrl: "https://example.com/goods/1",
    ...overrides
  };
}

function validate(overrides: Record<string, unknown> = {}) {
  const errors: HubEventValidationError[] = [];
  const item = validateHubEventGoodsItem(validItem(overrides), "items[0]", context, errors);
  return { item, errors };
}

describe("hubEventGoodsPolicy", () => {
  it("accepts and normalizes a valid item", () => {
    const { item, errors } = validate({ priceNote: "  ", scheduleItemId: "schedule-1" });

    expect(errors).toEqual([]);
    expect(item).toMatchObject({
      name: "아크릴 스탠드",
      groupLabel: "아크릴",
      memberIds: ["tenko-shibuki"],
      priceKrw: 12000,
      priceNote: null,
      salesChannel: "both",
      purchaseLimit: 3,
      scheduleItemId: "schedule-1"
    });
  });

  it("accepts zero price and omitted optional fields", () => {
    const errors: HubEventValidationError[] = [];
    const item = validateHubEventGoodsItem({ name: "특전 엽서", salesChannel: "onsite", isBonus: true, priceKrw: 0 }, "items[0]", context, errors);

    expect(errors).toEqual([]);
    expect(item).toMatchObject({ name: "특전 엽서", priceKrw: 0, isBonus: true });
  });

  it("requires a name and a known sales channel", () => {
    const { errors } = validate({ name: "   ", salesChannel: "mail" });

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "items[0].name", reason: "goods_item_required" }),
      expect.objectContaining({ field: "items[0].salesChannel", reason: "goods_sales_channel_invalid" })
    ]));
  });

  it("enforces text length caps", () => {
    const { errors } = validate({
      name: "가".repeat(161),
      groupLabel: "가".repeat(81),
      priceNote: "가".repeat(121),
      limitNote: "가".repeat(201)
    });

    expect(errors.map((error) => error.field)).toEqual([
      "items[0].name",
      "items[0].groupLabel",
      "items[0].priceNote",
      "items[0].limitNote"
    ]);
    expect(errors.every((error) => error.reason === "goods_item_too_long")).toBe(true);
  });

  it("rejects former, unknown, non-person and duplicate members", () => {
    const { errors } = validate({
      memberIds: ["tenko-shibuki", "tenko-shibuki", "former-member-x", "stellive-official", "gen4-placeholder"]
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "items[0].memberIds[1]", reason: "goods_member_duplicate" }),
      expect.objectContaining({ field: "items[0].memberIds[2]", reason: "goods_member_not_allowed" }),
      expect.objectContaining({ field: "items[0].memberIds[3]", reason: "goods_member_not_allowed" })
    ]));
  });

  it("rejects Gangzi like event-level member policy", () => {
    expect(validate({ memberIds: ["gangzi"] }).errors).toEqual([
      expect.objectContaining({ field: "items[0].memberIds[0]", reason: "gangzi_representative_excluded" })
    ]);
  });

  it("rejects negative or fractional prices and invalid purchase limits", () => {
    expect(validate({ priceKrw: -1 }).errors).toEqual([expect.objectContaining({ field: "items[0].priceKrw", reason: "goods_price_invalid" })]);
    expect(validate({ priceKrw: 10.5 }).errors).toEqual([expect.objectContaining({ field: "items[0].priceKrw" })]);
    expect(validate({ purchaseLimit: 0 }).errors).toEqual([expect.objectContaining({ field: "items[0].purchaseLimit", reason: "goods_purchase_limit_invalid" })]);
    expect(validate({ purchaseLimit: -2 }).errors).toEqual([expect.objectContaining({ field: "items[0].purchaseLimit" })]);
  });

  it("rejects non-HTTPS purchase URLs", () => {
    const { errors } = validate({ purchaseUrl: "http://example.com/goods/1" });

    expect(errors).toEqual([expect.objectContaining({ field: "items[0].purchaseUrl", reason: "url_not_https" })]);
  });

  it("rejects availability and other unknown keys", () => {
    const { errors } = validate({ availability: "sold_out", base64: "AAAA", bytes: [1, 2] });

    expect(errors.map((error) => [error.field, error.reason])).toEqual([
      ["items[0].availability", "goods_field_not_allowed"],
      ["items[0].base64", "goods_field_not_allowed"],
      ["items[0].bytes", "goods_field_not_allowed"]
    ]);
  });

  it("reuses the image policy and rejects binary image fields", () => {
    const { errors } = validate({
      image: { policyState: "official_runtime_url", url: "https://example.com/a.png", sourceLabel: "공식", sourceUrl: "https://example.com", base64: "AAAA" }
    });

    expect(errors).toEqual([expect.objectContaining({ field: "items[0].image.base64", reason: "image_asset_fields_not_allowed" })]);
  });

  it("rejects non-HTTPS displayable images and accepts a placeholder image", () => {
    expect(validate({ image: { policyState: "official_runtime_url", url: "http://example.com/a.png", sourceLabel: "공식", sourceUrl: "https://example.com" } }).errors)
      .toEqual([expect.objectContaining({ field: "items[0].image.url", reason: "image_url_not_https" })]);
    expect(validate({ image: { policyState: "none" } }).errors).toEqual([]);
    expect(validate({ image: null }).errors).toEqual([]);
  });

  it("rejects a scheduleItemId from another event", () => {
    const { errors } = validate({ scheduleItemId: "schedule-of-another-event" });

    expect(errors).toEqual([expect.objectContaining({ field: "items[0].scheduleItemId", reason: "goods_schedule_item_invalid" })]);
  });

  it("returns index-based paths for bulk validation and keeps nothing on failure", () => {
    const result = validateHubEventGoodsItems(
      [validItem(), validItem(), validItem(), validItem({ priceKrw: -5 }), validItem({ name: "" })],
      context
    );

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.map((error) => error.field)).toEqual(["items[3].priceKrw", "items[4].name"]);
  });

  it("rejects non-array bulk input, oversized lists and duplicate ids", () => {
    expect(validateHubEventGoodsItems({}, context)).toMatchObject({ valid: false, errors: [{ field: "items" }] });
    expect(validateHubEventGoodsItems(Array.from({ length: 201 }, () => validItem()), context)).toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ reason: "goods_items_too_many" })]
    });
    expect(validateHubEventGoodsItems([validItem({ id: "g1" }), validItem({ id: "g1" })], context)).toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ field: "items[1].id" })]
    });
  });

  describe("public projections", () => {
    const item = (overrides: Partial<HubEventGoodsItem>): HubEventGoodsItem => ({
      id: "g",
      name: "굿즈",
      memberIds: [],
      salesChannel: "online",
      isBonus: false,
      sortOrder: 0,
      ...overrides
    });
    const displayable = { policyState: "official_runtime_url" as const, url: "https://example.com/a.png", sourceLabel: "공식", sourceUrl: "https://example.com" };

    it("drops cancelled items, sorts by sortOrder and keeps only displayable images", () => {
      const items = toPublicGoodsItems([
        item({ id: "c", sortOrder: 2, image: { policyState: "blocked", url: "https://example.com/x.png" } }),
        item({ id: "a", sortOrder: 1, image: displayable }),
        item({ id: "gone", sortOrder: 0, cancelledAt: "2026-06-01T00:00:00.000Z" }),
        item({ id: "b", sortOrder: 0, image: { policyState: "none" } })
      ]);

      expect(items.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
      expect(items[0]).not.toHaveProperty("image");
      expect(items[1].image).toEqual(displayable);
      expect(items[2]).not.toHaveProperty("image");
      expect(items.some((entry) => "cancelledAt" in entry)).toBe(false);
      expect(countActiveGoodsItems([item({ id: "x" }), item({ id: "y", cancelledAt: "2026-06-01T00:00:00.000Z" })])).toBe(1);
    });

    it("withPublicGoodsItems omits an empty list and withGoodsCountOnly never carries items", () => {
      const base = { id: "e", title: "t" } as unknown as HubEvent;

      expect(withPublicGoodsItems({ ...base, goodsItems: [item({ cancelledAt: "2026-06-01T00:00:00.000Z" })] })).not.toHaveProperty("goodsItems");
      const counted = withGoodsCountOnly({ ...base, goodsItems: [item({ id: "a" }), item({ id: "b" })] });
      expect(counted).not.toHaveProperty("goodsItems");
      expect(counted.goodsCount).toBe(2);
      expect(withGoodsCountOnly({ ...base, goodsItems: [] })).not.toHaveProperty("goodsCount");
    });
  });
});

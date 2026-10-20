import type { CatalogService } from "../catalog/catalog.js";
import type { HubEvent, HubEventGoodsItem, HubEventGoodsSalesChannel, HubEventImage } from "../types.js";
import type { HubEventValidationError, HubEventValidationReason } from "./hubEventAdminTypes.js";
import { canDisplayHubEventImage, hasHttpsUrl, validateHubEventImageForAdmin } from "./hubEventPolicy.js";

export const maxHubEventGoodsItems = 200;
export const maxHubEventGoodsMemberIds = 30;
export const hubEventGoodsSalesChannels: readonly HubEventGoodsSalesChannel[] = ["onsite", "online", "both"];

const maxNameLength = 160; // same cap as schedule item title
const maxGroupLabelLength = 80; // same cap as schedule item label
const maxPriceNoteLength = 120;
const maxLimitNoteLength = 200;
const maxPurchaseUrlLength = 2_048;
const maxPriceKrw = 100_000_000;
const maxPurchaseLimit = 9_999;
const maxSortOrder = 100_000;

/** Keys a client may send. Anything else (availability, bytes, base64, ...) is rejected. */
const writableKeys = new Set([
  "id",
  "scheduleItemId",
  "name",
  "groupLabel",
  "memberIds",
  "priceKrw",
  "priceNote",
  "salesChannel",
  "purchaseLimit",
  "limitNote",
  "isBonus",
  "purchaseUrl",
  "image",
  "sortOrder",
  "cancelledAt"
]);
/** Server-owned keys that round-trip from admin GET responses and are ignored on write. */
const ignoredKeys = new Set(["createdAt", "updatedAt", "hubEventId"]);

export interface AdminHubEventGoodsItemWriteInput {
  id?: string;
  scheduleItemId?: string | null;
  name: string;
  groupLabel?: string | null;
  memberIds?: string[];
  priceKrw?: number | null;
  priceNote?: string | null;
  salesChannel: HubEventGoodsSalesChannel;
  purchaseLimit?: number | null;
  limitNote?: string | null;
  isBonus?: boolean;
  purchaseUrl?: string | null;
  image?: HubEventImage | null;
  sortOrder?: number;
  cancelledAt?: string | Date | null;
}

export interface HubEventGoodsValidationContext {
  catalog: CatalogService;
  /** Ids of the parent event's schedule items; scheduleItemId must be one of them. */
  scheduleItemIds: ReadonlySet<string>;
}

export type HubEventGoodsValidationResult =
  | { valid: true; items: AdminHubEventGoodsItemWriteInput[] }
  | { valid: false; errors: HubEventValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addError(errors: HubEventValidationError[], field: string, reason: HubEventValidationReason, message: string) {
  errors.push({ field, reason, message });
}

function readOptionalString(
  errors: HubEventValidationError[],
  raw: Record<string, unknown>,
  key: string,
  path: string,
  maxLength: number
): string | null | undefined {
  if (!(key in raw) || raw[key] === undefined) return undefined;
  const value = raw[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    addError(errors, `${path}.${key}`, "goods_item_invalid", `${key} must be a string.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    addError(errors, `${path}.${key}`, "goods_item_too_long", `${key} must be at most ${maxLength} characters.`);
    return undefined;
  }
  return trimmed || null;
}

function readOptionalInteger(
  errors: HubEventValidationError[],
  raw: Record<string, unknown>,
  key: "priceKrw" | "purchaseLimit",
  path: string
): number | null | undefined {
  if (!(key in raw) || raw[key] === undefined) return undefined;
  const value = raw[key];
  if (value === null) return null;
  const minimum = key === "purchaseLimit" ? 1 : 0;
  const maximum = key === "purchaseLimit" ? maxPurchaseLimit : maxPriceKrw;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    addError(
      errors,
      `${path}.${key}`,
      key === "purchaseLimit" ? "goods_purchase_limit_invalid" : "goods_price_invalid",
      `${key} must be an integer between ${minimum} and ${maximum}.`
    );
    return undefined;
  }
  return value;
}

function validateMemberIds(
  errors: HubEventValidationError[],
  raw: Record<string, unknown>,
  path: string,
  catalog: CatalogService
): string[] | undefined {
  if (!("memberIds" in raw) || raw.memberIds === undefined) return undefined;
  const value = raw.memberIds;
  if (!Array.isArray(value)) {
    addError(errors, `${path}.memberIds`, "goods_item_invalid", "memberIds must be an array.");
    return undefined;
  }
  if (value.length > maxHubEventGoodsMemberIds) {
    addError(errors, `${path}.memberIds`, "goods_item_invalid", `At most ${maxHubEventGoodsMemberIds} members are allowed.`);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((rawId, index) => {
    const field = `${path}.memberIds[${index}]`;
    const memberId = typeof rawId === "string" ? rawId.trim() : "";
    if (memberId === "gangzi") {
      addError(errors, field, "gangzi_representative_excluded", "Gangzi is excluded from MVP hub events.");
      return;
    }
    // CatalogService only exposes active/upcoming members, so former and unknown ids are both rejected.
    const member = memberId ? catalog.getMember(memberId) : undefined;
    if (!member || member.isPerson === false) {
      addError(errors, field, "goods_member_not_allowed", "Goods items can reference only active or upcoming catalog members.");
      return;
    }
    if (seen.has(memberId)) {
      addError(errors, field, "goods_member_duplicate", "memberIds must not contain duplicates.");
      return;
    }
    seen.add(memberId);
    result.push(memberId);
  });
  return result;
}

/**
 * Validates one raw goods item. `path` is the error-field prefix, e.g. `items[3]` or `goodsItem`.
 * Returns the normalized write input, or undefined when errors were appended.
 */
export function validateHubEventGoodsItem(
  rawItem: unknown,
  path: string,
  context: HubEventGoodsValidationContext,
  errors: HubEventValidationError[]
): AdminHubEventGoodsItemWriteInput | undefined {
  if (!isRecord(rawItem)) {
    addError(errors, path, "goods_item_invalid", "Goods item must be an object.");
    return undefined;
  }
  const startErrorCount = errors.length;

  for (const key of Object.keys(rawItem)) {
    if (!writableKeys.has(key) && !ignoredKeys.has(key)) {
      addError(errors, `${path}.${key}`, "goods_field_not_allowed", `${key} is not an allowed goods item field.`);
    }
  }

  const name = readOptionalString(errors, rawItem, "name", path, maxNameLength);
  if (name === undefined || name === null) {
    if (!errors.some((error) => error.field === `${path}.name`)) {
      addError(errors, `${path}.name`, "goods_item_required", "Goods item name is required.");
    }
  }
  const groupLabel = readOptionalString(errors, rawItem, "groupLabel", path, maxGroupLabelLength);
  const priceNote = readOptionalString(errors, rawItem, "priceNote", path, maxPriceNoteLength);
  const limitNote = readOptionalString(errors, rawItem, "limitNote", path, maxLimitNoteLength);
  const priceKrw = readOptionalInteger(errors, rawItem, "priceKrw", path);
  const purchaseLimit = readOptionalInteger(errors, rawItem, "purchaseLimit", path);
  const memberIds = validateMemberIds(errors, rawItem, path, context.catalog);

  const salesChannel = rawItem.salesChannel;
  if (typeof salesChannel !== "string" || !hubEventGoodsSalesChannels.includes(salesChannel as HubEventGoodsSalesChannel)) {
    addError(errors, `${path}.salesChannel`, "goods_sales_channel_invalid", "salesChannel must be onsite, online, or both.");
  }

  const purchaseUrl = readOptionalString(errors, rawItem, "purchaseUrl", path, maxPurchaseUrlLength);
  if (purchaseUrl && !hasHttpsUrl(purchaseUrl)) {
    addError(errors, `${path}.purchaseUrl`, "url_not_https", "purchaseUrl must be an HTTPS URL.");
  }

  let isBonus: boolean | undefined;
  if ("isBonus" in rawItem && rawItem.isBonus !== undefined) {
    if (typeof rawItem.isBonus === "boolean") isBonus = rawItem.isBonus;
    else addError(errors, `${path}.isBonus`, "goods_item_invalid", "isBonus must be a boolean.");
  }

  let scheduleItemId: string | null | undefined;
  if ("scheduleItemId" in rawItem && rawItem.scheduleItemId !== undefined && rawItem.scheduleItemId !== null) {
    const value = typeof rawItem.scheduleItemId === "string" ? rawItem.scheduleItemId.trim() : "";
    if (!value || !context.scheduleItemIds.has(value)) {
      addError(errors, `${path}.scheduleItemId`, "goods_schedule_item_invalid", "scheduleItemId must be a schedule item of the same event.");
    } else {
      scheduleItemId = value;
    }
  } else if ("scheduleItemId" in rawItem && rawItem.scheduleItemId === null) {
    scheduleItemId = null;
  }

  let sortOrder: number | undefined;
  if ("sortOrder" in rawItem && rawItem.sortOrder !== undefined) {
    const value = rawItem.sortOrder;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maxSortOrder) {
      addError(errors, `${path}.sortOrder`, "goods_sort_order_invalid", "sortOrder must be a non-negative integer.");
    } else {
      sortOrder = value;
    }
  }

  let cancelledAt: string | null | undefined;
  if ("cancelledAt" in rawItem && rawItem.cancelledAt !== undefined) {
    const value = rawItem.cancelledAt;
    if (value === null) cancelledAt = null;
    else if (typeof value === "string" && Number.isFinite(Date.parse(value))) cancelledAt = value;
    else addError(errors, `${path}.cancelledAt`, "goods_item_invalid", "cancelledAt must be an ISO date string or null.");
  }

  let id: string | undefined;
  if ("id" in rawItem && rawItem.id !== undefined) {
    if (typeof rawItem.id === "string" && rawItem.id.trim()) id = rawItem.id.trim();
    else addError(errors, `${path}.id`, "goods_item_invalid", "id must be a non-empty string.");
  }

  // Reuse the event image policy verbatim (policy state allow-list, HTTPS, source metadata, binary-field rejection).
  validateHubEventImageForAdmin(errors, rawItem, `${path}.image`);
  const image = rawItem.image === null ? null : isRecord(rawItem.image) ? (rawItem.image as unknown as HubEventImage) : undefined;

  if (errors.length > startErrorCount) return undefined;

  return stripUndefined({
    id,
    scheduleItemId,
    name: name as string,
    groupLabel,
    memberIds,
    priceKrw,
    priceNote,
    salesChannel: salesChannel as HubEventGoodsSalesChannel,
    purchaseLimit,
    limitNote,
    isBonus,
    purchaseUrl,
    image,
    sortOrder,
    cancelledAt
  }) as unknown as AdminHubEventGoodsItemWriteInput;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

/**
 * Validates a full goods list (bulk replace). Errors use index paths such as `items[3].priceKrw`;
 * nothing is returned for persistence unless every item is valid.
 */
export function validateHubEventGoodsItems(
  rawItems: unknown,
  context: HubEventGoodsValidationContext,
  field = "items"
): HubEventGoodsValidationResult {
  const errors: HubEventValidationError[] = [];
  if (!Array.isArray(rawItems)) {
    addError(errors, field, "goods_item_invalid", `${field} must be an array.`);
    return { valid: false, errors };
  }
  if (rawItems.length > maxHubEventGoodsItems) {
    addError(errors, field, "goods_items_too_many", `A hub event can contain at most ${maxHubEventGoodsItems} goods items.`);
  }
  const items: AdminHubEventGoodsItemWriteInput[] = [];
  const seenIds = new Set<string>();
  rawItems.forEach((rawItem, index) => {
    const item = validateHubEventGoodsItem(rawItem, `${field}[${index}]`, context, errors);
    if (!item) return;
    if (item.id) {
      if (seenIds.has(item.id)) {
        addError(errors, `${field}[${index}].id`, "goods_item_invalid", "Goods item ids must be unique.");
        return;
      }
      seenIds.add(item.id);
    }
    items.push(item);
  });
  return errors.length > 0 ? { valid: false, errors } : { valid: true, items };
}

/** Public detail projection: non-cancelled items in sortOrder, images only when displayable. */
export function toPublicGoodsItems(items: readonly HubEventGoodsItem[] | undefined): HubEventGoodsItem[] {
  return (items ?? [])
    .filter((item) => !item.cancelledAt)
    .map((item) => {
      const { image, cancelledAt: _cancelledAt, ...rest } = item;
      return canDisplayHubEventImage(image) ? { ...rest, image } : rest;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function countActiveGoodsItems(items: readonly HubEventGoodsItem[] | undefined): number {
  return (items ?? []).filter((item) => !item.cancelledAt).length;
}

/** Detail response: replaces goodsItems with the public projection and drops goodsCount. */
export function withPublicGoodsItems<T extends HubEvent>(event: T): T {
  const { goodsItems, goodsCount: _goodsCount, ...rest } = event;
  const publicItems = toPublicGoodsItems(goodsItems);
  return (publicItems.length > 0 ? { ...rest, goodsItems: publicItems } : rest) as T;
}

/** List/calendar/widget/bootstrap payloads: never carry goodsItems; goodsCount only when > 0. */
export function withGoodsCountOnly<T extends HubEvent>(event: T): T {
  const { goodsItems, goodsCount, ...rest } = event;
  const count = goodsItems !== undefined ? countActiveGoodsItems(goodsItems) : goodsCount ?? 0;
  return (count > 0 ? { ...rest, goodsCount: count } : rest) as T;
}

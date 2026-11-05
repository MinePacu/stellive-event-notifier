import type { HubEvent, HubEventGoodsGalleryLayout, HubEventGoodsListImage, HubEventGoodsListImageKind } from "../types.js";
import type { HubEventValidationError, HubEventValidationReason } from "./hubEventAdminTypes.js";
import { canDisplayHubEventImage, hasHttpsUrl, validateHubEventImageForAdmin } from "./hubEventPolicy.js";

/**
 * Official MD list image gallery (HubEvent.goodsListImages).
 *
 * Everything gallery-specific lives in this file so the feature can be rolled back by removing the
 * few call sites listed in docs/HUB_EVENT_GOODS_ITEMS_DESIGN.md. Kill switch: HUB_EVENT_GOODS_GALLERY_ENABLED.
 */

export const maxHubEventGoodsListImages = 20;

/** Exact host or any subdomain of these; runtime URLs from any other host are rejected for the gallery only. */
const allowedGalleryDomains = ["stellive.me"] as const;
const allowedGalleryExactHosts = ["pbs.twimg.com"] as const;

const goodsListImageKinds = new Set<string>(["md", "bonus"]);

const imagePolicyStates = new Set(["none", "official_runtime_url", "third_party_allowed", "verify_required", "blocked"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addError(errors: HubEventValidationError[], field: string, reason: HubEventValidationReason, message: string) {
  errors.push({ field, reason, message });
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isAllowedGoodsGalleryImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    allowedGalleryExactHosts.some((allowed) => host === allowed) ||
    allowedGalleryDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

/**
 * Validates `input.goodsListImages` for an admin event write. Returns no errors when the field is absent
 * or null (null clears the list). Each image reuses validateHubEventImageForAdmin (paths like
 * `goodsListImages.3.url`); official_runtime_url images must additionally be hosted on the gallery allowlist.
 */
export function validateHubEventGoodsListImages(input: unknown): HubEventValidationError[] {
  const errors: HubEventValidationError[] = [];
  if (!isRecord(input)) return errors;
  const raw = input.goodsListImages;
  if (raw === undefined || raw === null) return errors;

  if (!Array.isArray(raw)) {
    addError(errors, "goodsListImages", "goods_list_images_invalid", "goodsListImages must be an array.");
    return errors;
  }
  if (raw.length > maxHubEventGoodsListImages) {
    addError(
      errors,
      "goodsListImages",
      "goods_list_images_too_many",
      `At most ${maxHubEventGoodsListImages} goods list images are allowed.`
    );
  }

  raw.forEach((entry, index) => {
    const path = `goodsListImages.${index}`;
    if (!isRecord(entry)) {
      addError(errors, path, "goods_list_images_invalid", "Each goods list image must be an object.");
      return;
    }
    const before = errors.length;
    validateHubEventImageForAdmin(errors, { image: entry }, path);
    const imageInvalid = errors.length > before;
    if (entry.kind !== undefined && !(typeof entry.kind === "string" && goodsListImageKinds.has(entry.kind))) {
      addError(errors, `${path}.kind`, "goods_list_image_kind_invalid", 'Goods list image kind must be "md" or "bonus".');
    }
    if (imageInvalid) return;

    if (entry.policyState === "official_runtime_url") {
      const url = trimmedString(entry.url);
      if (url && hasHttpsUrl(url) && !isAllowedGoodsGalleryImageHost(new URL(url).hostname)) {
        addError(
          errors,
          `${path}.url`,
          "goods_list_image_host_not_allowed",
          "Goods list image URL host must be stellive.me (or a subdomain) or pbs.twimg.com."
        );
      }
    }
  });

  return errors;
}

/**
 * Lenient normalizer for stored/written values: keeps only known image fields on well-formed entries.
 * Returns undefined when the input is not an array or nothing usable remains.
 */
export function normalizeGoodsListImages(value: unknown): HubEventGoodsListImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const images: HubEventGoodsListImage[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const policyState = trimmedString(entry.policyState);
    if (!policyState || !imagePolicyStates.has(policyState)) continue;
    const image: Record<string, unknown> = { policyState };
    for (const key of ["url", "sourceLabel", "sourceUrl", "altText"] as const) {
      const text = trimmedString(entry[key]);
      if (text !== undefined) image[key] = text;
    }
    // Absent kind stays absent; an unknown stored kind is dropped rather than failing the whole entry.
    if (typeof entry.kind === "string" && goodsListImageKinds.has(entry.kind)) image.kind = entry.kind as HubEventGoodsListImageKind;
    images.push(image as unknown as HubEventGoodsListImage);
  }
  return images.length > 0 ? images : undefined;
}

/** Public detail projection: displayable images only, original order; field omitted when none remain. */
export function withPublicGoodsListImages<T extends HubEvent>(event: T): T {
  const { goodsListImages, ...rest } = event;
  const displayable = (normalizeGoodsListImages(goodsListImages) ?? []).filter((image) => canDisplayHubEventImage(image));
  return (displayable.length > 0 ? { ...rest, goodsListImages: displayable } : rest) as T;
}

/** List/calendar/widget/summary payloads: never carry goodsListImages. */
export function withoutGoodsListImages<T extends HubEvent>(event: T): T {
  if (!("goodsListImages" in event) && !("goodsListLayout" in event)) return event;
  const { goodsListImages: _goodsListImages, goodsListLayout: _goodsListLayout, ...rest } = event;
  return rest as T;
}

/**
 * Kill switch (HUB_EVENT_GOODS_GALLERY_ENABLED=false): public responses omit goodsListImages (and the layout).
 * When enabled, the server-driven layout (HUB_EVENT_GOODS_GALLERY_LAYOUT) is added to the public detail
 * only if goodsListImages is present in that response.
 */
export function applyGoodsGalleryKillSwitch<T extends HubEvent>(
  event: T,
  enabled: boolean,
  layout: HubEventGoodsGalleryLayout = "split"
): T {
  if (!enabled) return withoutGoodsListImages(event);
  if (!event.goodsListImages?.length) return withoutGoodsListLayout(event);
  return { ...event, goodsListLayout: layout };
}

function withoutGoodsListLayout<T extends HubEvent>(event: T): T {
  if (!("goodsListLayout" in event)) return event;
  const { goodsListLayout: _goodsListLayout, ...rest } = event;
  return rest as T;
}

import type { CatalogService } from "../catalog/catalog.js";
import type {
  HubEvent,
  HubEventCategory,
  HubEventLinkKind,
  HubEventScheduleKind,
  HubEventScheduleMode,
  HubEventSourceType,
  HubEventStatus,
  HubEventTimePrecision
} from "../types.js";
import type {
  HubEventAdminValidationResult,
  HubEventValidationError,
  HubEventValidationReason
} from "./hubEventAdminTypes.js";
import { hubEventLinkKinds } from "./hubEventLinkPolicy.js";
import { isHubEventTag, maxHubEventTags } from "./hubEventTagPolicy.js";

const allowedSourceTypes = new Set<HubEventSourceType>(["official", "member", "official_collab"]);
const allowedCategories = new Set<HubEventCategory>([
  "online_goods",
  "online_collab",
  "offline_concert",
  "offline_collab",
  "offline_popup",
  "ticketing"
]);
const allowedStatuses = new Set<HubEventStatus>(["announced", "upcoming", "open", "closing_soon", "ended", "cancelled"]);
const displayableImagePolicyStates = new Set(["official_runtime_url", "third_party_allowed"]);
const allowedScheduleModes = new Set<HubEventScheduleMode>(["single_window", "timeline"]);
const allowedScheduleKinds = new Set<HubEventScheduleKind>([
  "main_window",
  "announcement",
  "sales_open",
  "ticket_open",
  "content_reveal",
  "release",
  "deadline",
  "custom"
]);
const allowedTimePrecisions = new Set<HubEventTimePrecision>(["date", "datetime"]);
const allowedLinkKinds = new Set<HubEventLinkKind>(hubEventLinkKinds);

export function canDisplayHubEventImage(image: HubEvent["image"]): boolean {
  if (!image?.url || !displayableImagePolicyStates.has(image.policyState)) {
    return false;
  }

  try {
    return new URL(image.url).protocol === "https:";
  } catch {
    return false;
  }
}
const assetFields = ["imageUrl", "logoUrl", "posterUrl", "thumbnailUrl", "profileImageUrl"] as const;
const imageAssetFields = ["bytes", "base64", "assetPath", "filePath", "localPath"] as const;
const allowedImagePolicyStates = new Set(["none", "official_runtime_url", "third_party_allowed", "verify_required", "blocked"]);

export type HubEventValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "source_required"
        | "source_type_not_allowed"
        | "unsupported_category"
        | "unsupported_status"
        | "asset_fields_not_allowed"
        | "gangzi_representative_excluded"
        | "gamja_scope_excluded"
        | "member_not_allowed"
        | "member_generation_mismatch"
        | "date_window_required";
    };

function hasAssetField(event: HubEvent): boolean {
  return assetFields.some((field) => Object.prototype.hasOwnProperty.call(event, field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(input: Record<string, unknown>, field: string): string | undefined {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
}

function hasUntrustedAssetField(input: Record<string, unknown>): boolean {
  return assetFields.some((field) => Object.prototype.hasOwnProperty.call(input, field));
}

function addError(errors: HubEventValidationError[], field: string, reason: HubEventValidationReason, message: string) {
  errors.push({ field, reason, message });
}

function validateTags(errors: HubEventValidationError[], rawTags: unknown) {
  if (rawTags === undefined) return;
  if (!Array.isArray(rawTags)) {
    addError(errors, "tags", "tags_not_array", "tags must be an array.");
    return;
  }
  if (rawTags.length > maxHubEventTags) {
    addError(errors, "tags", "tags_too_many", `At most ${maxHubEventTags} tag is allowed.`);
  }
  rawTags.forEach((rawTag, index) => {
    const tag = typeof rawTag === "string" ? rawTag.trim() : "";
    if (!isHubEventTag(tag)) {
      addError(errors, `tags.${index}`, "unsupported_tag", "Unsupported hub event tag.");
    }
  });
}

function hasHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function addHttpsUrlErrorIfNeeded(errors: HubEventValidationError[], input: Record<string, unknown>, field: string) {
  const value = stringField(input, field);
  if (!value) return;
  if (!hasHttpsUrl(value)) {
    addError(errors, field, "url_not_https", `${field} must be an HTTPS URL.`);
  }
}

function validateLinks(
  errors: HubEventValidationError[],
  rawLinks: unknown,
  field: string,
  maximum: number
) {
  if (rawLinks === undefined) return;
  if (!Array.isArray(rawLinks)) {
    addError(errors, field, "link_invalid", "links must be an array.");
    return;
  }
  if (rawLinks.length > maximum) {
    addError(errors, field, "links_too_many", `At most ${maximum} links are allowed.`);
  }
  const urls = new Set<string>();
  rawLinks.forEach((rawLink, index) => {
    const linkField = `${field}.${index}`;
    if (!isRecord(rawLink)) {
      addError(errors, linkField, "link_invalid", "Link must be an object.");
      return;
    }
    const kind = stringField(rawLink, "kind") as HubEventLinkKind | undefined;
    if (!kind || !allowedLinkKinds.has(kind)) {
      addError(errors, `${linkField}.kind`, "link_kind_not_allowed", "Unsupported link kind.");
    }
    const label = stringField(rawLink, "label")?.trim();
    if (kind === "custom" && !label) {
      addError(errors, `${linkField}.label`, "link_label_required", "Custom links require a label.");
    }
    if (label && label.length > 80) {
      addError(errors, `${linkField}.label`, "link_label_too_long", "Link label must be at most 80 characters.");
    }
    const url = stringField(rawLink, "url")?.trim();
    if (!url || !hasHttpsUrl(url)) {
      addError(errors, `${linkField}.url`, "url_not_https", "Link URL must be an HTTPS URL.");
    } else if (urls.has(url)) {
      addError(errors, `${linkField}.url`, "link_url_duplicate", "Link URLs must be unique within their owner.");
    } else {
      urls.add(url);
    }
    const sortOrder = rawLink.sortOrder;
    if (!Number.isInteger(sortOrder) || Number(sortOrder) < 0) {
      addError(errors, `${linkField}.sortOrder`, "link_sort_order_invalid", "sortOrder must be a non-negative integer.");
    }
  });
}

function validateHubEventImageForAdmin(errors: HubEventValidationError[], input: Record<string, unknown>) {
  if (!("image" in input) || input.image === undefined || input.image === null) {
    return;
  }

  if (!isRecord(input.image)) {
    addError(errors, "image", "image_policy_state_not_allowed", "image must be an object.");
    return;
  }

  const image = input.image;
  const policyState = stringField(image, "policyState");
  if (!policyState || !allowedImagePolicyStates.has(policyState)) {
    addError(errors, "image.policyState", "image_policy_state_not_allowed", "image policyState is not allowed.");
    return;
  }

  const hasReviewMetadata = ["url", "sourceLabel", "sourceUrl", "altText"].some((field) =>
    Boolean(stringField(image, field)?.trim())
  );
  if (policyState === "none" && hasReviewMetadata) {
    addError(
      errors,
      "image.policyState",
      "image_policy_state_not_allowed",
      "image policyState none cannot be saved with image metadata."
    );
    return;
  }

  for (const field of imageAssetFields) {
    if (field in image) {
      addError(errors, `image.${field}`, "image_asset_fields_not_allowed", "Image binary or local asset fields are not allowed.");
    }
  }

  if (!displayableImagePolicyStates.has(policyState)) {
    return;
  }

  const url = stringField(image, "url")?.trim();
  const sourceLabel = stringField(image, "sourceLabel")?.trim();
  const sourceUrl = stringField(image, "sourceUrl")?.trim();

  if (!url) {
    addError(errors, "image.url", "image_url_not_https", "Displayable image metadata requires an HTTPS image URL.");
  } else if (!hasHttpsUrl(url)) {
    addError(errors, "image.url", "image_url_not_https", "Image URL must be HTTPS.");
  }

  if (!sourceLabel || !sourceUrl) {
    addError(errors, "image.source", "image_source_required", "Displayable image metadata requires sourceLabel and sourceUrl.");
  } else if (!hasHttpsUrl(sourceUrl)) {
    addError(errors, "image.sourceUrl", "image_url_not_https", "Image sourceUrl must be HTTPS.");
  }
}

function asTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

function isOfficialYoutubeLiveInput(input: Record<string, unknown>): boolean {
  if (input.generationId !== "official" || input.sourceType !== "official") return false;

  const sourceUrl = stringField(input, "sourceUrl");
  if (!sourceUrl) return false;

  try {
    const url = new URL(sourceUrl);
    const hostname = url.hostname.toLowerCase();
    const isYoutube = hostname === "youtu.be" || hostname.endsWith("youtube.com");
    return isYoutube && (url.pathname.startsWith("/live") || url.searchParams.get("event") === "live");
  } catch {
    return false;
  }
}

function hasAnyDateField(input: Record<string, unknown>): boolean {
  return Boolean(
    stringField(input, "announcedAt") ||
    stringField(input, "startsAt") ||
    stringField(input, "endsAt") ||
    (Array.isArray(input.scheduleItems) && input.scheduleItems.some((item) => isRecord(item) && Boolean(stringField(item, "startsAt"))))
  );
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validatesPrecision(value: string, precision: HubEventTimePrecision): boolean {
  if (precision === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value);
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && asTime(value) !== undefined;
}

function validateScheduleItems(
  errors: HubEventValidationError[],
  input: Record<string, unknown>,
  mode: "draft" | "publish"
) {
  const scheduleMode = (stringField(input, "scheduleMode") ?? "single_window") as HubEventScheduleMode;
  if (!allowedScheduleModes.has(scheduleMode)) {
    addError(errors, "scheduleMode", "schedule_mode_not_allowed", "scheduleMode must be single_window or timeline.");
    return;
  }

  const rawItems = input.scheduleItems;
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    addError(errors, "scheduleItems", "schedule_item_invalid", "scheduleItems must be an array.");
    return;
  }
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length > 50) {
    addError(errors, "scheduleItems", "schedule_items_too_many", "A hub event can contain at most 50 schedule items.");
  }

  let activeCount = 0;
  let primaryCount = 0;
  items.forEach((rawItem, index) => {
    const field = `scheduleItems.${index}`;
    if (!isRecord(rawItem)) {
      addError(errors, field, "schedule_item_invalid", "Schedule item must be an object.");
      return;
    }
    const cancelled = Boolean(stringField(rawItem, "cancelledAt"));
    if (!cancelled) activeCount += 1;
    if (!cancelled && rawItem.isPrimary === true) primaryCount += 1;

    const kind = stringField(rawItem, "kind") as HubEventScheduleKind | undefined;
    if (!kind || !allowedScheduleKinds.has(kind)) {
      addError(errors, `${field}.kind`, "schedule_item_kind_not_allowed", "Unsupported schedule item kind.");
    }
    const title = stringField(rawItem, "title")?.trim();
    const label = stringField(rawItem, "label")?.trim();
    const description = stringField(rawItem, "description")?.trim();
    if (!title && !label) {
      addError(errors, `${field}.title`, "schedule_item_required", "Schedule item title or label is required.");
    }
    if (title && title.length > 160) {
      addError(errors, `${field}.title`, "schedule_item_too_long", "Schedule item title must be at most 160 characters.");
    }
    if (label && label.length > 80) {
      addError(errors, `${field}.label`, "schedule_item_too_long", "Schedule item label must be at most 80 characters.");
    }
    if (description && description.length > 2_000) {
      addError(errors, `${field}.description`, "schedule_item_too_long", "Schedule item description must be at most 2,000 characters.");
    }
    const startsAt = stringField(rawItem, "startsAt");
    if (!startsAt || asTime(startsAt) === undefined) {
      addError(errors, `${field}.startsAt`, "schedule_item_required", "A valid startsAt is required.");
    }
    const endsAt = stringField(rawItem, "endsAt");
    if (startsAt && endsAt && asTime(startsAt)! > asTime(endsAt)!) {
      addError(errors, `${field}.endsAt`, "date_window_invalid", "endsAt must be greater than or equal to startsAt.");
    }
    const precision = stringField(rawItem, "timePrecision") as HubEventTimePrecision | undefined;
    if (!precision || !allowedTimePrecisions.has(precision)) {
      addError(errors, `${field}.timePrecision`, "schedule_item_precision_invalid", "timePrecision must be date or datetime.");
    } else {
      if (startsAt && !validatesPrecision(startsAt, precision)) {
        addError(errors, `${field}.startsAt`, "schedule_item_precision_invalid", "startsAt does not match timePrecision.");
      }
      if (endsAt && !validatesPrecision(endsAt, precision)) {
        addError(errors, `${field}.endsAt`, "schedule_item_precision_invalid", "endsAt does not match timePrecision.");
      }
    }
    const timezone = stringField(rawItem, "timezone") ?? "Asia/Seoul";
    if (!validTimezone(timezone)) {
      addError(errors, `${field}.timezone`, "schedule_item_timezone_invalid", "Schedule item timezone is invalid.");
    }
    for (const urlField of ["actionUrl", "sourceUrl"] as const) {
      const value = stringField(rawItem, urlField);
      if (value && !hasHttpsUrl(value)) {
        addError(errors, `${field}.${urlField}`, "url_not_https", `${urlField} must be an HTTPS URL.`);
      }
    }
    validateLinks(errors, rawItem.links, `${field}.links`, 10);
  });

  if (primaryCount > 1) {
    addError(errors, "scheduleItems", "schedule_primary_duplicate", "Only one active schedule item can be primary.");
  }
  if (mode === "publish" && scheduleMode === "timeline") {
    if (activeCount === 0) {
      addError(errors, "scheduleItems", "schedule_item_required", "A published timeline requires an active schedule item.");
    }
    if (primaryCount !== 1) {
      addError(errors, "scheduleItems", "schedule_primary_required", "A published timeline requires exactly one active primary schedule item.");
    }
  }
}

export function validateHubEvent(event: HubEvent, catalog: CatalogService): HubEventValidationResult {
  if (!event.sourceUrl.trim() || !event.sourceLabel.trim()) {
    return { valid: false, reason: "source_required" };
  }

  if (!allowedSourceTypes.has(event.sourceType)) {
    return { valid: false, reason: "source_type_not_allowed" };
  }

  if (!allowedCategories.has(event.category)) {
    return { valid: false, reason: "unsupported_category" };
  }

  if (!allowedStatuses.has(event.status)) {
    return { valid: false, reason: "unsupported_status" };
  }

  if (hasAssetField(event)) {
    return { valid: false, reason: "asset_fields_not_allowed" };
  }

  if (event.memberId === "gangzi") {
    return { valid: false, reason: "gangzi_representative_excluded" };
  }

  if (event.generationId === "gamja") {
    return { valid: false, reason: "gamja_scope_excluded" };
  }

  if (event.memberId) {
    const member = catalog.getMember(event.memberId);
    if (!member || member.activeStatus !== "active" && member.activeStatus !== "upcoming") {
      return { valid: false, reason: "member_not_allowed" };
    }
    if (member.generationId !== event.generationId) {
      return { valid: false, reason: "member_generation_mismatch" };
    }
  }

  if (event.status !== "announced" && event.status !== "cancelled" && !event.startsAt && !event.endsAt) {
    return { valid: false, reason: "date_window_required" };
  }

  return { valid: true };
}

export function validateHubEventForAdmin(
  input: unknown,
  catalog: CatalogService,
  mode: "draft" | "publish"
): HubEventAdminValidationResult {
  const errors: HubEventValidationError[] = [];

  if (!isRecord(input)) {
    addError(errors, "body", "source_required", "Hub event input is required.");
    return { valid: false, errors };
  }

  validateTags(errors, input.tags);

  const sourceUrl = stringField(input, "sourceUrl")?.trim();
  const sourceLabel = stringField(input, "sourceLabel")?.trim();
  const sourceType = stringField(input, "sourceType") as HubEventSourceType | undefined;
  const category = stringField(input, "category") as HubEventCategory | undefined;
  const status = stringField(input, "status") as HubEventStatus | undefined;
  const memberId = stringField(input, "memberId");
  const generationId = stringField(input, "generationId");

  if (!sourceUrl || !sourceLabel) {
    addError(errors, "source", "source_required", "sourceUrl and sourceLabel are required.");
  }

  if (!sourceType || !allowedSourceTypes.has(sourceType)) {
    addError(errors, "sourceType", "source_type_not_allowed", "sourceType must be official, member, or official_collab.");
  }

  if (!category || !allowedCategories.has(category)) {
    addError(errors, "category", "unsupported_category", "Unsupported hub event category.");
  }

  if (!status || !allowedStatuses.has(status)) {
    addError(errors, "status", "unsupported_status", "Unsupported hub event status.");
  }

  if (hasUntrustedAssetField(input)) {
    addError(errors, "assets", "asset_fields_not_allowed", "Image, logo, poster, thumbnail, and profile image fields are not allowed.");
  }

  if (memberId === "gangzi") {
    addError(errors, "memberId", "gangzi_representative_excluded", "Gangzi is excluded from MVP hub events.");
  }

  if (generationId === "gamja") {
    addError(errors, "generationId", "gamja_scope_excluded", "The gamja category is excluded from MVP hub events.");
  }

  if (memberId) {
    const member = catalog.getMember(memberId);
    if (!member || member.activeStatus !== "active" && member.activeStatus !== "upcoming") {
      addError(errors, "memberId", "member_not_allowed", "MVP hub events can reference only active or upcoming members.");
    } else if (member.generationId !== generationId) {
      addError(errors, "generationId", "member_generation_mismatch", "memberId and generationId must refer to the same catalog entry.");
    }
  }

  addHttpsUrlErrorIfNeeded(errors, input, "sourceUrl");
  addHttpsUrlErrorIfNeeded(errors, input, "purchaseUrl");
  addHttpsUrlErrorIfNeeded(errors, input, "ticketUrl");
  validateLinks(errors, input.links, "links", 20);
  validateHubEventImageForAdmin(errors, input);
  validateScheduleItems(errors, input, mode);

  const startsAt = asTime(stringField(input, "startsAt"));
  const endsAt = asTime(stringField(input, "endsAt"));
  if (startsAt !== undefined && endsAt !== undefined && startsAt > endsAt) {
    addError(errors, "endsAt", "date_window_invalid", "endsAt must be greater than or equal to startsAt.");
  }

  if (mode === "publish" && !hasAnyDateField(input)) {
    addError(errors, "dateWindow", "date_window_required", "A published hub event requires announcedAt, startsAt, or endsAt.");
  }

  if (isOfficialYoutubeLiveInput(input)) {
    addError(
      errors,
      "sourceUrl",
      "official_youtube_live_excluded",
      "Official YouTube live scheduled, started, and ended events are excluded."
    );
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

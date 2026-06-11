import type { CatalogService } from "../catalog/catalog.js";
import type { HubEvent, HubEventCategory, HubEventSourceType, HubEventStatus } from "../types.js";
import type {
  HubEventAdminValidationResult,
  HubEventValidationError,
  HubEventValidationReason
} from "./hubEventAdminTypes.js";

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
const assetFields = ["imageUrl", "logoUrl", "posterUrl", "thumbnailUrl", "profileImageUrl"] as const;

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
  return Boolean(stringField(input, "announcedAt") || stringField(input, "startsAt") || stringField(input, "endsAt"));
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

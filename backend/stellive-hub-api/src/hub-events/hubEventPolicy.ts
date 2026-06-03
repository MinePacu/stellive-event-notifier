import type { CatalogService } from "../catalog/catalog.js";
import type { HubEvent, HubEventCategory, HubEventSourceType, HubEventStatus } from "../types.js";

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

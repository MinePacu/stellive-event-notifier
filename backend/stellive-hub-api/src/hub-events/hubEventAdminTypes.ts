import type { HubEvent } from "../types.js";

export type HubEventPublicationState = "draft" | "published" | "inactive" | "deleted";

export type HubEventAdminAction =
  | "create"
  | "update"
  | "publish"
  | "cancel"
  | "deactivate"
  | "delete"
  | "schedule_create"
  | "schedule_update"
  | "schedule_cancel"
  | "schedule_restore"
  | "schedule_delete"
  | "schedule_reorder";

export interface AdminHubEvent extends HubEvent {
  publicationState: HubEventPublicationState;
  publishedAt?: string;
  cancelledAt?: string;
  deactivatedAt?: string;
  deletedAt?: string;
  revision: number;
  createdBy?: string;
  updatedBy?: string;
}

export type HubEventValidationReason =
  | "source_required"
  | "source_type_not_allowed"
  | "unsupported_category"
  | "unsupported_status"
  | "asset_fields_not_allowed"
  | "image_source_required"
  | "image_url_not_https"
  | "image_policy_state_not_allowed"
  | "image_asset_fields_not_allowed"
  | "gangzi_representative_excluded"
  | "gamja_scope_excluded"
  | "member_not_allowed"
  | "member_generation_mismatch"
  | "date_window_required"
  | "date_window_invalid"
  | "schedule_mode_not_allowed"
  | "schedule_items_too_many"
  | "schedule_item_invalid"
  | "schedule_item_required"
  | "schedule_item_kind_not_allowed"
  | "schedule_item_precision_invalid"
  | "schedule_item_timezone_invalid"
  | "schedule_primary_required"
  | "schedule_primary_duplicate"
  | "url_not_https"
  | "official_youtube_live_excluded"
  | "routine_platform_activity_excluded";

export interface HubEventValidationError {
  field: string;
  reason: HubEventValidationReason;
  message: string;
}

export type HubEventAdminValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: HubEventValidationError[] };

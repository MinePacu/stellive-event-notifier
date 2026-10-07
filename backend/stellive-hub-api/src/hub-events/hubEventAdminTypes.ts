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
  | "schedule_reorder"
  | "goods_create"
  | "goods_update"
  | "goods_cancel"
  | "goods_restore"
  | "goods_reorder"
  | "goods_replace";

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
  | "tags_not_array"
  | "unsupported_tag"
  | "tags_too_many"
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
  | "schedule_item_too_long"
  | "schedule_item_kind_not_allowed"
  | "schedule_item_precision_invalid"
  | "schedule_item_timezone_invalid"
  | "schedule_primary_required"
  | "schedule_primary_duplicate"
  | "links_too_many"
  | "link_invalid"
  | "link_kind_not_allowed"
  | "link_label_required"
  | "link_label_too_long"
  | "link_url_duplicate"
  | "link_sort_order_invalid"
  | "goods_items_too_many"
  | "goods_item_invalid"
  | "goods_item_required"
  | "goods_item_too_long"
  | "goods_field_not_allowed"
  | "goods_sales_channel_invalid"
  | "goods_member_not_allowed"
  | "goods_member_duplicate"
  | "goods_price_invalid"
  | "goods_purchase_limit_invalid"
  | "goods_schedule_item_invalid"
  | "goods_sort_order_invalid"
  | "goods_list_images_invalid"
  | "goods_list_images_too_many"
  | "goods_list_image_host_not_allowed"
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

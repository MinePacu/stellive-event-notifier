export type MobileErrorCode =
  | "device_not_registered"
  | "device_token_invalid"
  | "device_token_provider_invalid"
  | "preference_conflict"
  | "preference_stale_update"
  | "preference_client_updated_at_invalid"
  | "catalog_version_unsupported"
  | "feature_disabled"
  | "rate_limited"
  | "server_unavailable"
  | "unauthorized";

export function mobileError(code: MobileErrorCode, statusCode: number) {
  return {
    statusCode,
    payload: { error: code },
  };
}

export type MobileErrorCode =
  | "device_not_registered"
  | "device_token_invalid"
  | "preference_conflict"
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

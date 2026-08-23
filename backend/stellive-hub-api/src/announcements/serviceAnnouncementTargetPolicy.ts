import type { ServiceAnnouncementPlatform } from "../../../../shared/schemas/domain.js";

export const SERVICE_ANNOUNCEMENT_TARGETING_POLICY_VERSION = 1 as const;

export type ServiceAnnouncementTargetSkipReason =
  | "service_announcement_platform_mismatch"
  | "service_announcement_version_below_minimum"
  | "service_announcement_version_above_maximum"
  | "service_announcement_version_unknown"
  | "service_announcement_target_metadata_missing";

export type ServiceAnnouncementTargetInput = {
  targetPlatforms?: readonly ServiceAnnouncementPlatform[];
  minimumAppVersion?: string | null;
  maximumAppVersion?: string | null;
  platform?: ServiceAnnouncementPlatform;
  appVersion?: string | null;
  requireMetadata?: boolean;
  requireVersionForBounds?: boolean;
};

export type ServiceAnnouncementTargetDecision =
  | { eligible: true; reason?: undefined }
  | { eligible: false; reason: ServiceAnnouncementTargetSkipReason };

const versionPattern = /^\d+(?:\.\d+)*(?:[-+][0-9A-Za-z][0-9A-Za-z.-]*)?$/;

export function isValidAppVersion(value: string): boolean {
  return value.trim().length > 0 && versionPattern.test(value.trim());
}

export function compareAppVersions(left: string, right: string): number {
  const parse = (value: string) => value.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function evaluateServiceAnnouncementTarget(input: ServiceAnnouncementTargetInput): ServiceAnnouncementTargetDecision {
  const hasMetadata = Array.isArray(input.targetPlatforms)
    && (input.minimumAppVersion === undefined || input.minimumAppVersion === null || typeof input.minimumAppVersion === "string")
    && (input.maximumAppVersion === undefined || input.maximumAppVersion === null || typeof input.maximumAppVersion === "string");
  if (input.requireMetadata && !hasMetadata) return { eligible: false, reason: "service_announcement_target_metadata_missing" };

  const targetPlatforms = input.targetPlatforms ?? [];
  if (input.platform && targetPlatforms.length > 0 && !targetPlatforms.includes(input.platform)) {
    return { eligible: false, reason: "service_announcement_platform_mismatch" };
  }

  const minimum = input.minimumAppVersion ?? undefined;
  const maximum = input.maximumAppVersion ?? undefined;
  if (!minimum && !maximum) return { eligible: true };
  if (!input.appVersion && input.requireVersionForBounds === false) return { eligible: true };
  if (!input.appVersion || !isValidAppVersion(input.appVersion)) {
    return { eligible: false, reason: "service_announcement_version_unknown" };
  }
  if (minimum && compareAppVersions(input.appVersion, minimum) < 0) {
    return { eligible: false, reason: "service_announcement_version_below_minimum" };
  }
  if (maximum && compareAppVersions(input.appVersion, maximum) > 0) {
    return { eligible: false, reason: "service_announcement_version_above_maximum" };
  }
  return { eligible: true };
}

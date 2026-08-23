import { describe, expect, it } from "vitest";
import {
  evaluateServiceAnnouncementTarget,
  isValidAppVersion,
} from "../src/announcements/serviceAnnouncementTargetPolicy.js";

describe("service announcement target policy", () => {
  const base = { targetPlatforms: ["android", "ios"] as const };

  it("matches platform and treats version bounds as inclusive", () => {
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "android", appVersion: "2.0.0", minimumAppVersion: "2.0.0", maximumAppVersion: "2.1.0" })).toEqual({ eligible: true });
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "ios", appVersion: "1.9.9", minimumAppVersion: "2.0.0" }).eligible).toBe(false);
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "ios", appVersion: "2.2.0", maximumAppVersion: "2.1.0" }).eligible).toBe(false);
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "ios", appVersion: "2.0.0", minimumAppVersion: "2.0.0" }).eligible).toBe(true);
  });

  it("fails closed for missing or malformed versions when bounded", () => {
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "android", minimumAppVersion: "2.0.0" })).toEqual({ eligible: false, reason: "service_announcement_version_unknown" });
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "android", appVersion: "beta", minimumAppVersion: "2.0.0" })).toEqual({ eligible: false, reason: "service_announcement_version_unknown" });
    expect(isValidAppVersion("2.0.0-beta")).toBe(true);
    expect(isValidAppVersion("beta")).toBe(false);
  });

  it("allows missing app version when no bounds exist", () => {
    expect(evaluateServiceAnnouncementTarget({ ...base, platform: "ios" })).toEqual({ eligible: true });
  });

  it("requires immutable metadata for worker events", () => {
    expect(evaluateServiceAnnouncementTarget({ platform: "android", requireMetadata: true })).toEqual({
      eligible: false,
      reason: "service_announcement_target_metadata_missing",
    });
  });
});

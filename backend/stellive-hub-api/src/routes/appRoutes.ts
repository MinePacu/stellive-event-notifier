import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  BootstrapResponse,
  MobilePlatform,
  PushTokenProvider
} from "../../../../shared/schemas/mobileApi.js";
import { mobileError } from "../mobile/mobileError.js";
import { rateLimitHook, type MobileRateLimiters } from "../mobile/requestRateLimiter.js";
import {
  PreferenceConflictError,
  PreferenceStaleUpdateError,
  type PreferenceSnapshot,
} from "../repositories/preferenceRepository.js";
import { DeviceTokenClaimUnavailableError } from "../repositories/deviceRepository.js";
import type { UserNotificationPreference } from "../types.js";

export interface MobileAppRouteDependencies {
  bootstrap?: {
    getBootstrap(input: {
      deviceId?: string;
      platform?: MobilePlatform;
      appVersion?: string;
      locale?: string;
      timezone?: string;
    }): Promise<BootstrapResponse>;
  };
  devices?: {
    register?(input: {
      deviceId?: string;
      platform: MobilePlatform;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    }): Promise<{ deviceId: string; registered: true }>;
    updateToken?(input: {
      deviceId: string;
      platform: MobilePlatform;
      provider: "fcm" | "apns_via_fcm";
      token: string;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    }): Promise<{ updated: true; tokenStatus: "active" }>;
    getDevice?(deviceId: string): Promise<{ deviceId: string } | undefined>;
  };
  preferences?: {
    listForDevice?(deviceId: string): Promise<UserNotificationPreference[]>;
    getSnapshotForDevice?(deviceId: string): Promise<PreferenceSnapshot>;
    replaceForDevice?(input: {
      deviceId: string;
      preferences: UserNotificationPreference[];
      expectedRevision: number;
      clientUpdatedAt?: string;
    }): Promise<PreferenceSnapshot>;
  };
}

export interface RegisterAppRouteOptions {
  dependencies?: MobileAppRouteDependencies;
  rateLimiters?: MobileRateLimiters;
  fallbackPreferences?: Map<string, UserNotificationPreference[]>;
  fallbackBootstrap?: (query: {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
    locale?: string;
    timezone?: string;
  }) => Promise<unknown> | unknown;
}

function parsePlatform(value: string | undefined): MobilePlatform {
  return value === "ios" ? "ios" : "android";
}

function parsePushTokenProvider(value: string | undefined): PushTokenProvider | undefined {
  if (value === "fcm" || value === "apns_via_fcm") return value;
  return undefined;
}

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MINTED_DEVICE_ID_PATTERN = /^device_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_METADATA_LENGTH = 64;
const MAX_PUSH_TOKEN_LENGTH = 4096;
// The catalog allows at most ~460 distinct rules (13 members, 6 generations, 5 sources, 17 event types
// across every scope combination); 500 leaves a little headroom while bounding the delete+reinsert per request.
const MAX_PREFERENCE_RULES = 500;

function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value);
}

function mintedDeviceIdOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && MINTED_DEVICE_ID_PATTERN.test(value) ? value : undefined;
}

function metadataOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= MAX_METADATA_LENGTH ? value : undefined;
}

function latestPreferenceUpdatedAt(preferences: UserNotificationPreference[]): string {
  return (
    preferences
      .map((rule) => rule.updatedAt)
      .filter((updatedAt): updatedAt is string => Boolean(updatedAt))
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}

function isValidPreferenceRule(rule: unknown): rule is UserNotificationPreference {
  if (typeof rule !== "object" || rule === null) return false;
  const r = rule as Record<string, unknown>;
  // Validate the fields dereferenced downstream (e.g. updatedAt sorting, enabled/scope gating)
  // so a malformed element cannot crash preference resolution after being persisted.
  return (
    typeof r.scope === "string" && r.scope.length > 0 &&
    typeof r.enabled === "boolean" &&
    typeof r.tapAction === "string" &&
    typeof r.deliveryMode === "string" &&
    typeof r.updatedAt === "string"
  );
}

export async function registerAppRoutes(app: FastifyInstance, options: RegisterAppRouteOptions = {}) {
  const fallbackPreferences = options.fallbackPreferences ?? new Map<string, UserNotificationPreference[]>();
  const fallbackPreferenceMetadata = new Map<string, { revision: number; updatedAt: string; lastClientUpdatedAt?: string }>();

  const writeRateLimit = rateLimitHook(options.rateLimiters?.write);
  const readRateLimit = rateLimitHook(options.rateLimiters?.read);

  app.get("/v1/bootstrap", { onRequest: readRateLimit }, async (request) => {
    const query = request.query as {
      deviceId?: unknown;
      platform?: unknown;
      appVersion?: unknown;
      locale?: unknown;
      timezone?: unknown;
    };

    const sanitized = {
      deviceId: isValidDeviceId(query.deviceId) ? query.deviceId : undefined,
      platform: typeof query.platform === "string" ? query.platform : undefined,
      appVersion: metadataOrUndefined(query.appVersion),
      locale: metadataOrUndefined(query.locale),
      timezone: metadataOrUndefined(query.timezone),
    };

    if (!options.dependencies?.bootstrap) return options.fallbackBootstrap?.(sanitized);

    return options.dependencies.bootstrap.getBootstrap({
      ...sanitized,
      platform: parsePlatform(typeof query.platform === "string" ? query.platform : undefined),
    });
  });

  app.post("/v1/devices/register", { onRequest: writeRateLimit }, async (request) => {
    const body = request.body as {
      deviceId?: string;
      platform?: string;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    };
    const devices = options.dependencies?.devices;
    const result = devices?.register
      ? await devices.register({
          deviceId: mintedDeviceIdOrUndefined(body.deviceId),
          platform: parsePlatform(body.platform),
          locale: metadataOrUndefined(body.locale),
          timezone: metadataOrUndefined(body.timezone),
          appVersion: metadataOrUndefined(body.appVersion),
        })
      : {
          deviceId: mintedDeviceIdOrUndefined(body.deviceId) ?? `device_${Date.now()}`,
          registered: true as const,
        };
    return { ...result, serverTime: new Date().toISOString() };
  });

  app.put("/v1/devices/token", { onRequest: writeRateLimit }, async (request, reply) => {
    const body = request.body as {
      deviceId?: string;
      platform?: string;
      provider?: string;
      token?: string;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    };
    if (
      !isValidDeviceId(body.deviceId) ||
      typeof body.token !== "string" ||
      body.token.length < 1 ||
      body.token.length > MAX_PUSH_TOKEN_LENGTH
    ) {
      const error = mobileError("device_token_invalid", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const provider = parsePushTokenProvider(body.provider);
    if (!provider) {
      const error = mobileError("device_token_provider_invalid", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const devices = options.dependencies?.devices;
    let result: { updated: true; tokenStatus: "active" };
    try {
      result = devices?.updateToken
        ? await devices.updateToken({
            deviceId: body.deviceId,
            platform: parsePlatform(body.platform),
            provider,
            token: body.token,
            locale: metadataOrUndefined(body.locale),
            timezone: metadataOrUndefined(body.timezone),
            appVersion: metadataOrUndefined(body.appVersion),
          })
        : { updated: true as const, tokenStatus: "active" as const };
    } catch (error) {
      if (error instanceof DeviceTokenClaimUnavailableError) {
        const unavailable = mobileError("server_unavailable", 503);
        return reply.code(unavailable.statusCode).send(unavailable.payload);
      }
      throw error;
    }
    return { ...result, serverTime: new Date().toISOString() };
  });

  app.get("/v1/preferences", { onRequest: readRateLimit }, async (request, reply) => {
    const deviceId = (request.query as { deviceId?: unknown }).deviceId;
    if (!isValidDeviceId(deviceId)) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const preferences = options.dependencies?.preferences;
    if (preferences?.getSnapshotForDevice) {
      const snapshot = await preferences.getSnapshotForDevice(deviceId);
      return { deviceId, ...snapshot };
    }

    const rules = preferences?.listForDevice
      ? await preferences.listForDevice(deviceId)
      : fallbackPreferences.get(deviceId) ?? [];
    const metadata = fallbackPreferenceMetadata.get(deviceId);
    return {
      deviceId,
      preferences: rules,
      revision: metadata?.revision ?? 0,
      updatedAt: metadata?.updatedAt ?? latestPreferenceUpdatedAt(rules),
    };
  });

  app.put("/v1/preferences", { onRequest: writeRateLimit }, async (request, reply) => {
    const body = request.body as {
      deviceId?: string;
      preferences?: UserNotificationPreference[];
      expectedRevision?: number;
      clientUpdatedAt?: string;
    };
    if (!isValidDeviceId(body.deviceId)) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }
    if (!Number.isInteger(body.expectedRevision) || (body.expectedRevision ?? -1) < 0) {
      return reply.code(400).send({ error: "preference_revision_invalid" });
    }
    if (!Array.isArray(body.preferences) || body.preferences.length > MAX_PREFERENCE_RULES) {
      return reply.code(400).send({ error: "preferences_invalid" });
    }
    const rules = body.preferences;
    if (!rules.every(isValidPreferenceRule)) {
      return reply.code(400).send({ error: "preferences_invalid" });
    }
    if (body.clientUpdatedAt !== undefined && (typeof body.clientUpdatedAt !== "string" || Number.isNaN(new Date(body.clientUpdatedAt).getTime()))) {
      return reply.code(400).send({ error: "preference_client_updated_at_invalid" });
    }

    const preferences = options.dependencies?.preferences;
    if (preferences?.replaceForDevice) {
      // NotificationPreference has no FK to Device; require a registered device so arbitrary ids cannot create rows.
      const devices = options.dependencies?.devices;
      if (devices?.getDevice && !(await devices.getDevice(body.deviceId))) {
        const error = mobileError("device_not_registered", 400);
        return reply.code(error.statusCode).send(error.payload);
      }
      let result: PreferenceSnapshot;
      try {
        result = await preferences.replaceForDevice({
          deviceId: body.deviceId,
          preferences: rules,
          expectedRevision: body.expectedRevision!,
          clientUpdatedAt: body.clientUpdatedAt,
        });
      } catch (error) {
        if (error instanceof PreferenceStaleUpdateError) {
          const conflict = mobileError("preference_stale_update", 409);
          return reply.code(conflict.statusCode).send(conflict.payload);
        }
        if (error instanceof PreferenceConflictError) {
          const conflict = mobileError("preference_conflict", 409);
          return reply.code(conflict.statusCode).send(conflict.payload);
        }
        throw error;
      }
      return { deviceId: body.deviceId, ...result };
    }

    const currentRevision = fallbackPreferenceMetadata.get(body.deviceId)?.revision ?? 0;
    const currentClientUpdatedAt = fallbackPreferenceMetadata.get(body.deviceId)?.lastClientUpdatedAt;
    if (currentRevision !== body.expectedRevision) {
      const conflict = mobileError("preference_conflict", 409);
      return reply.code(conflict.statusCode).send(conflict.payload);
    }
    if (body.clientUpdatedAt && currentClientUpdatedAt && new Date(body.clientUpdatedAt) <= new Date(currentClientUpdatedAt)) {
      const conflict = mobileError("preference_stale_update", 409);
      return reply.code(conflict.statusCode).send(conflict.payload);
    }
    const updatedAt = new Date().toISOString();
    const revision = currentRevision + 1;
    fallbackPreferences.set(body.deviceId, rules);
    fallbackPreferenceMetadata.set(body.deviceId, { revision, updatedAt, lastClientUpdatedAt: body.clientUpdatedAt });
    return { deviceId: body.deviceId, preferences: rules, revision, updatedAt };
  });
}

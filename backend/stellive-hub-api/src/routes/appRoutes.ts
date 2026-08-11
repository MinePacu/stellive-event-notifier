import type { FastifyInstance } from "fastify";
import type {
  BootstrapResponse,
  MobilePlatform,
  PushTokenProvider
} from "../../../../shared/schemas/mobileApi.js";
import { mobileError } from "../mobile/mobileError.js";
import {
  PreferenceConflictError,
  type PreferenceSnapshot,
} from "../repositories/preferenceRepository.js";
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
  };
  preferences?: {
    listForDevice?(deviceId: string): Promise<UserNotificationPreference[]>;
    getSnapshotForDevice?(deviceId: string): Promise<PreferenceSnapshot>;
    replaceForDevice?(input: {
      deviceId: string;
      preferences: UserNotificationPreference[];
      expectedRevision: number;
    }): Promise<PreferenceSnapshot>;
  };
  serviceTopicSubscriptions?: {
    syncToken?(input: { token: string; preferences: UserNotificationPreference[] }): Promise<unknown>;
    syncDevice?(input: { deviceId: string; preferences: UserNotificationPreference[] }): Promise<unknown>;
  };
}

export interface RegisterAppRouteOptions {
  dependencies?: MobileAppRouteDependencies;
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

function latestPreferenceUpdatedAt(preferences: UserNotificationPreference[]): string {
  return (
    preferences
      .map((rule) => rule.updatedAt)
      .filter((updatedAt): updatedAt is string => Boolean(updatedAt))
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}

export async function registerAppRoutes(app: FastifyInstance, options: RegisterAppRouteOptions = {}) {
  const fallbackPreferences = options.fallbackPreferences ?? new Map<string, UserNotificationPreference[]>();
  const fallbackPreferenceMetadata = new Map<string, { revision: number; updatedAt: string }>();

  app.get("/v1/bootstrap", async (request) => {
    const query = request.query as {
      deviceId?: string;
      platform?: string;
      appVersion?: string;
      locale?: string;
      timezone?: string;
    };

    if (!options.dependencies?.bootstrap) return options.fallbackBootstrap?.(query);

    return options.dependencies.bootstrap.getBootstrap({
      deviceId: query.deviceId,
      platform: parsePlatform(query.platform),
      appVersion: query.appVersion,
      locale: query.locale,
      timezone: query.timezone,
    });
  });

  app.post("/v1/devices/register", async (request) => {
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
          deviceId: body.deviceId,
          platform: parsePlatform(body.platform),
          locale: body.locale,
          timezone: body.timezone,
          appVersion: body.appVersion,
        })
      : {
          deviceId: body.deviceId ?? `device_${Date.now()}`,
          registered: true as const,
        };
    return { ...result, serverTime: new Date().toISOString() };
  });

  app.put("/v1/devices/token", async (request, reply) => {
    const body = request.body as {
      deviceId?: string;
      platform?: string;
      provider?: string;
      token?: string;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    };
    if (!body.deviceId || !body.token) {
      const error = mobileError("device_token_invalid", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const provider = parsePushTokenProvider(body.provider);
    if (!provider) {
      const error = mobileError("device_token_provider_invalid", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const devices = options.dependencies?.devices;
    const result = devices?.updateToken
      ? await devices.updateToken({
          deviceId: body.deviceId,
          platform: parsePlatform(body.platform),
          provider,
          token: body.token,
          locale: body.locale,
          timezone: body.timezone,
          appVersion: body.appVersion,
        })
      : { updated: true as const, tokenStatus: "active" as const };
    if (options.dependencies?.serviceTopicSubscriptions?.syncToken) {
      try {
        const preferences = await options.dependencies.preferences?.listForDevice?.(body.deviceId) ?? [];
        await options.dependencies.serviceTopicSubscriptions.syncToken({ token: body.token, preferences });
      } catch (error) {
        request.log.warn({ error }, "service topic subscription sync failed after token update");
      }
    }
    return { ...result, serverTime: new Date().toISOString() };
  });

  app.get("/v1/preferences", async (request, reply) => {
    const deviceId = (request.query as { deviceId?: string }).deviceId;
    if (!deviceId) {
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

  app.put("/v1/preferences", async (request, reply) => {
    const body = request.body as {
      deviceId?: string;
      preferences?: UserNotificationPreference[];
      expectedRevision?: number;
    };
    if (!body.deviceId) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }
    if (!Number.isInteger(body.expectedRevision) || (body.expectedRevision ?? -1) < 0) {
      return reply.code(400).send({ error: "preference_revision_invalid" });
    }

    const preferences = options.dependencies?.preferences;
    if (preferences?.replaceForDevice) {
      let result: PreferenceSnapshot;
      try {
        result = await preferences.replaceForDevice({
          deviceId: body.deviceId,
          preferences: body.preferences ?? [],
          expectedRevision: body.expectedRevision!,
        });
      } catch (error) {
        if (error instanceof PreferenceConflictError) {
          const conflict = mobileError("preference_conflict", 409);
          return reply.code(conflict.statusCode).send(conflict.payload);
        }
        throw error;
      }
      if (options.dependencies?.serviceTopicSubscriptions?.syncDevice) {
        try {
          await options.dependencies.serviceTopicSubscriptions.syncDevice({ deviceId: body.deviceId, preferences: result.preferences });
        } catch (error) {
          request.log.warn({ error }, "service topic subscription sync failed after preference update");
        }
      }
      return { deviceId: body.deviceId, ...result };
    }

    const rules = body.preferences ?? [];
    const currentRevision = fallbackPreferenceMetadata.get(body.deviceId)?.revision ?? 0;
    if (currentRevision !== body.expectedRevision) {
      const conflict = mobileError("preference_conflict", 409);
      return reply.code(conflict.statusCode).send(conflict.payload);
    }
    const updatedAt = new Date().toISOString();
    const revision = currentRevision + 1;
    fallbackPreferences.set(body.deviceId, rules);
    fallbackPreferenceMetadata.set(body.deviceId, { revision, updatedAt });
    if (options.dependencies?.serviceTopicSubscriptions?.syncDevice) {
      try {
        await options.dependencies.serviceTopicSubscriptions.syncDevice({ deviceId: body.deviceId, preferences: rules });
      } catch (error) {
        request.log.warn({ error }, "service topic subscription sync failed after preference update");
      }
    }
    return { deviceId: body.deviceId, preferences: rules, revision, updatedAt };
  });
}

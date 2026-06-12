import type { FastifyInstance } from "fastify";
import type { BootstrapResponse, MobilePlatform } from "../../../../shared/schemas/mobileApi.js";
import { mobileError } from "../mobile/mobileError.js";
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
    replaceForDevice?(input: {
      deviceId: string;
      preferences: UserNotificationPreference[];
      clientUpdatedAt: string;
    }): Promise<{ preferences: UserNotificationPreference[]; updatedAt: string }>;
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

function latestPreferenceUpdatedAt(preferences: UserNotificationPreference[]): string {
  return (
    preferences
      .map((rule) => rule.updatedAt)
      .filter((updatedAt): updatedAt is string => Boolean(updatedAt))
      .sort()
      .at(-1) ?? new Date().toISOString()
  );
}

export async function registerAppRoutes(app: FastifyInstance, options: RegisterAppRouteOptions = {}) {
  const fallbackPreferences = options.fallbackPreferences ?? new Map<string, UserNotificationPreference[]>();

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
    const register = options.dependencies?.devices?.register;
    const result = register
      ? await register({
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

    const updateToken = options.dependencies?.devices?.updateToken;
    const result = updateToken
      ? await updateToken({
          deviceId: body.deviceId,
          platform: parsePlatform(body.platform),
          provider: body.provider === "apns_via_fcm" ? "apns_via_fcm" : "fcm",
          token: body.token,
          locale: body.locale,
          timezone: body.timezone,
          appVersion: body.appVersion,
        })
      : { updated: true as const, tokenStatus: "active" as const };
    return { ...result, serverTime: new Date().toISOString() };
  });

  app.get("/v1/preferences", async (request, reply) => {
    const deviceId = (request.query as { deviceId?: string }).deviceId;
    if (!deviceId) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const listForDevice = options.dependencies?.preferences?.listForDevice;
    const rules = listForDevice
      ? await listForDevice(deviceId)
      : fallbackPreferences.get(deviceId) ?? [];
    return {
      deviceId,
      preferences: rules,
      updatedAt: latestPreferenceUpdatedAt(rules),
    };
  });

  app.put("/v1/preferences", async (request, reply) => {
    const body = request.body as {
      deviceId?: string;
      preferences?: UserNotificationPreference[];
      clientUpdatedAt?: string;
    };
    if (!body.deviceId) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }

    const replaceForDevice = options.dependencies?.preferences?.replaceForDevice;
    if (replaceForDevice) {
      const result = await replaceForDevice({
        deviceId: body.deviceId,
        preferences: body.preferences ?? [],
        clientUpdatedAt: body.clientUpdatedAt ?? new Date().toISOString(),
      });
      return { deviceId: body.deviceId, ...result };
    }

    const rules = body.preferences ?? [];
    fallbackPreferences.set(body.deviceId, rules);
    return { deviceId: body.deviceId, preferences: rules, updatedAt: new Date().toISOString() };
  });
}

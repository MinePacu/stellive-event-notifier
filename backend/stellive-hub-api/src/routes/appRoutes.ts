import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  BootstrapResponse,
  MobilePlatform,
  PushTokenProvider
} from "../../../../shared/schemas/mobileApi.js";
import { mobileError } from "../mobile/mobileError.js";
import {
  PreferenceConflictError,
  PreferenceStaleUpdateError,
  type PreferenceSnapshot,
} from "../repositories/preferenceRepository.js";
import {
  serviceAnnouncementsEnabled,
  type ServiceTopicSyncResult,
} from "../push/serviceTopicSubscription.js";
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
      clientUpdatedAt?: string;
    }): Promise<PreferenceSnapshot>;
  };
  serviceTopicSubscriptions?: {
    syncToken?(input: { token: string; preferences: UserNotificationPreference[] }): Promise<ServiceTopicSyncResult>;
    syncDevice?(input: { deviceId: string; preferences: UserNotificationPreference[] }): Promise<ServiceTopicSyncResult>;
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

function serviceTopicSyncStatus(result: ServiceTopicSyncResult): string {
  if (typeof result !== "object" || result === null) return "unknown";
  const status = (result as { status?: unknown }).status;
  return typeof status === "string" ? status : "unknown";
}

function serviceTopicOptOutIsSafe(result: ServiceTopicSyncResult): boolean {
  const status = serviceTopicSyncStatus(result);
  return status === "synced" || status === "token_missing";
}

async function requireServiceTopicOptOut(
  request: FastifyRequest,
  sync: () => Promise<ServiceTopicSyncResult>,
): Promise<boolean> {
  try {
    const result = await sync();
    if (serviceTopicOptOutIsSafe(result)) return true;
    request.log.warn(
      { status: serviceTopicSyncStatus(result) },
      "service topic opt-out sync failed before update",
    );
  } catch {
    request.log.warn("service topic opt-out sync threw before update");
  }
  return false;
}

async function syncServiceTopicsBestEffort(
  request: FastifyRequest,
  sync: () => Promise<ServiceTopicSyncResult>,
  message: string,
): Promise<void> {
  try {
    const result = await sync();
    if (serviceTopicSyncStatus(result) !== "synced") {
      request.log.warn({ status: serviceTopicSyncStatus(result) }, message);
    }
  } catch {
    request.log.warn(message);
  }
}

async function compensateServiceTopicOptOutFailure(
  request: FastifyRequest,
  deviceId: string,
  preferences: MobileAppRouteDependencies["preferences"],
  syncDevice: (input: {
    deviceId: string;
    preferences: UserNotificationPreference[];
  }) => Promise<ServiceTopicSyncResult>,
): Promise<void> {
  let currentPreferences: UserNotificationPreference[] | undefined;
  if (preferences?.getSnapshotForDevice) {
    try {
      currentPreferences = (await preferences.getSnapshotForDevice(deviceId)).preferences;
    } catch {
      // Fall through to the list port when the snapshot read is unavailable.
    }
  }
  if (!currentPreferences && preferences?.listForDevice) {
    try {
      currentPreferences = await preferences.listForDevice(deviceId);
    } catch {
      // The sanitized warning below covers both read ports.
    }
  }
  if (!currentPreferences) {
    request.log.warn("service topic compensation preferences unavailable after preference update failure");
    return;
  }
  await syncServiceTopicsBestEffort(
    request,
    () => syncDevice({ deviceId, preferences: currentPreferences }),
    "service topic compensation sync failed after preference update failure",
  );
}

export async function registerAppRoutes(app: FastifyInstance, options: RegisterAppRouteOptions = {}) {
  const fallbackPreferences = options.fallbackPreferences ?? new Map<string, UserNotificationPreference[]>();
  const fallbackPreferenceMetadata = new Map<string, { revision: number; updatedAt: string; lastClientUpdatedAt?: string }>();

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

    const serviceTopicSubscriptions = options.dependencies?.serviceTopicSubscriptions;
    const syncToken = serviceTopicSubscriptions?.syncToken?.bind(serviceTopicSubscriptions);
    const preferences = syncToken
      ? await options.dependencies?.preferences?.listForDevice?.(body.deviceId) ?? []
      : [];
    const topicOptOut = !serviceAnnouncementsEnabled(preferences);
    if (topicOptOut && syncToken) {
      const safe = await requireServiceTopicOptOut(
        request,
        () => syncToken({ token: body.token!, preferences }),
      );
      if (!safe) {
        const error = mobileError("server_unavailable", 503);
        return reply.code(error.statusCode).send(error.payload);
      }
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
    if (!topicOptOut && syncToken) {
      await syncServiceTopicsBestEffort(
        request,
        () => syncToken({ token: body.token!, preferences }),
        "service topic subscription sync failed after token update",
      );
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
      clientUpdatedAt?: string;
    };
    if (!body.deviceId) {
      const error = mobileError("device_not_registered", 400);
      return reply.code(error.statusCode).send(error.payload);
    }
    if (!Number.isInteger(body.expectedRevision) || (body.expectedRevision ?? -1) < 0) {
      return reply.code(400).send({ error: "preference_revision_invalid" });
    }
    if (!Array.isArray(body.preferences)) {
      return reply.code(400).send({ error: "preferences_invalid" });
    }
    const rules = body.preferences;
    if (body.clientUpdatedAt !== undefined && (typeof body.clientUpdatedAt !== "string" || Number.isNaN(new Date(body.clientUpdatedAt).getTime()))) {
      return reply.code(400).send({ error: "preference_client_updated_at_invalid" });
    }

    const preferences = options.dependencies?.preferences;
    const serviceTopicSubscriptions = options.dependencies?.serviceTopicSubscriptions;
    const syncDevice = serviceTopicSubscriptions?.syncDevice?.bind(serviceTopicSubscriptions);
    const topicOptOut = !serviceAnnouncementsEnabled(rules);

    if (preferences?.replaceForDevice) {
      let preOptOutSynchronized = false;
      if (topicOptOut && syncDevice) {
        if (preferences.getSnapshotForDevice) {
          const currentSnapshot = await preferences.getSnapshotForDevice(body.deviceId);
          if (currentSnapshot.revision !== body.expectedRevision) {
            const conflict = mobileError("preference_conflict", 409);
            return reply.code(conflict.statusCode).send(conflict.payload);
          }
        }
        const safe = await requireServiceTopicOptOut(
          request,
          () => syncDevice({ deviceId: body.deviceId!, preferences: rules }),
        );
        if (!safe) {
          const error = mobileError("server_unavailable", 503);
          return reply.code(error.statusCode).send(error.payload);
        }
        preOptOutSynchronized = true;
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
        if (preOptOutSynchronized && syncDevice) {
          await compensateServiceTopicOptOutFailure(request, body.deviceId, preferences, syncDevice);
        }
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
      if (!topicOptOut && syncDevice) {
        await syncServiceTopicsBestEffort(
          request,
          () => syncDevice({ deviceId: body.deviceId!, preferences: result.preferences }),
          "service topic subscription sync failed after preference update",
        );
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
    if (topicOptOut && syncDevice) {
      const safe = await requireServiceTopicOptOut(
        request,
        () => syncDevice({ deviceId: body.deviceId!, preferences: rules }),
      );
      if (!safe) {
        const error = mobileError("server_unavailable", 503);
        return reply.code(error.statusCode).send(error.payload);
      }
    }

    const updatedAt = new Date().toISOString();
    const revision = currentRevision + 1;
    fallbackPreferences.set(body.deviceId, rules);
    fallbackPreferenceMetadata.set(body.deviceId, { revision, updatedAt, lastClientUpdatedAt: body.clientUpdatedAt });
    if (!topicOptOut && syncDevice) {
      await syncServiceTopicsBestEffort(
        request,
        () => syncDevice({ deviceId: body.deviceId!, preferences: rules }),
        "service topic subscription sync failed after preference update",
      );
    }
    return { deviceId: body.deviceId, preferences: rules, revision, updatedAt };
  });
}

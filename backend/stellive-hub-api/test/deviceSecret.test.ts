import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import BootstrapService from "../src/mobile/bootstrapService.js";
import {
  checkDeviceSecret,
  DeviceAuthFailedError,
  generateDeviceSecret,
  hashDeviceSecret,
} from "../src/mobile/deviceSecret.js";
import DeviceRepository from "../src/repositories/deviceRepository.js";

type FakeRecord = Record<string, unknown> & { id: string; secretHash?: string | null };

function createFakePrisma(seed: FakeRecord[] = []) {
  const records = new Map(seed.map((record) => [record.id, { ...record }]));
  const device = {
    async create(args: { data: FakeRecord }) {
      if (records.has(args.data.id)) throw Object.assign(new Error("unique"), { code: "P2002" });
      records.set(args.data.id, { ...args.data });
      return args.data;
    },
    async findUnique(args: { where: { id: string } }) {
      return records.get(args.where.id) ?? null;
    },
    async upsert(args: { where: { id: string }; create: FakeRecord; update: Record<string, unknown> }) {
      const existing = records.get(args.where.id);
      records.set(args.where.id, existing ? { ...existing, ...args.update } : { ...args.create });
      return records.get(args.where.id);
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      let count = 0;
      for (const [id, record] of records) {
        const where = args.where;
        if (typeof where.id === "string" && where.id !== id) continue;
        if (typeof where.id === "object" && (where.id as { not: string }).not === id) continue;
        if (where.deviceToken !== undefined && record.deviceToken !== where.deviceToken) continue;
        if (where.tokenStatus !== undefined && record.tokenStatus !== where.tokenStatus) continue;
        if (where.secretHash === null && record.secretHash) continue;
        records.set(id, { ...record, ...args.data });
        count += 1;
      }
      return { count };
    },
  };
  return {
    records,
    prisma: { device, $transaction: async <T>(operation: (tx: unknown) => Promise<T>) => operation({ device }) },
  };
}

const SECURED_SECRET = "known-device-secret";
const LEGACY_ID = "device_00000000-0000-4000-8000-000000000001";
const SECURED_ID = "device_00000000-0000-4000-8000-000000000002";

function seededRepository() {
  const fake = createFakePrisma([
    { id: LEGACY_ID, platform: "android", tokenStatus: "missing", secretHash: null },
    { id: SECURED_ID, platform: "android", tokenStatus: "missing", secretHash: hashDeviceSecret(SECURED_SECRET) },
  ]);
  return { ...fake, repository: new DeviceRepository(fake.prisma as never) };
}

describe("device secret helpers", () => {
  it("generates a 256-bit base64url secret and stores only its SHA-256 hex", () => {
    const { secret, hash } = generateDeviceSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(createHash("sha256").update(secret).digest("hex"));
  });

  it("compares secrets against the stored hash", () => {
    const hash = hashDeviceSecret("right");
    expect(checkDeviceSecret(hash, "right")).toBe("ok");
    expect(checkDeviceSecret(hash, "wrong")).toBe("mismatch");
    expect(checkDeviceSecret(hash, undefined)).toBe("mismatch");
    expect(checkDeviceSecret(hash, ["right"])).toBe("mismatch");
    expect(checkDeviceSecret("abcd", "right")).toBe("mismatch");
    expect(checkDeviceSecret(null, undefined)).toBe("legacy");
  });
});

describe("DeviceRepository device secrets", () => {
  it("issues a secret to a new device and stores only its hash", async () => {
    const { prisma, records } = createFakePrisma();
    const repository = new DeviceRepository(prisma as never, () => new Date(), () => "device-new");

    const result = await repository.register({ platform: "ios", deviceSecretSupported: true });

    expect(result.deviceSecret).toEqual(expect.any(String));
    expect(records.get("device-new")?.secretHash).toBe(hashDeviceSecret(result.deviceSecret!));
    expect(JSON.stringify([...records.values()])).not.toContain(result.deviceSecret);
  });

  it("issues a secret to a minted device id that does not exist yet", async () => {
    const { repository, records } = seededRepository();
    const id = "device_00000000-0000-4000-8000-000000000009";

    const result = await repository.register({ deviceId: id, platform: "android", deviceSecretSupported: true });

    expect(result).toMatchObject({ deviceId: id, deviceSecret: expect.any(String) });
    expect(records.get(id)?.secretHash).toBe(hashDeviceSecret(result.deviceSecret!));
  });

  it("lets a legacy device claim a secret exactly once", async () => {
    const { repository, records } = seededRepository();

    const first = await repository.register({ deviceId: LEGACY_ID, platform: "android", appVersion: "1.0", deviceSecretSupported: true });
    expect(first.deviceSecret).toEqual(expect.any(String));
    const storedHash = records.get(LEGACY_ID)?.secretHash;
    expect(storedHash).toBe(hashDeviceSecret(first.deviceSecret!));

    await expect(
      repository.register({ deviceId: LEGACY_ID, platform: "android", deviceSecretSupported: true }),
    ).rejects.toBeInstanceOf(DeviceAuthFailedError);
    // A hashed device stays protected even when an old client omits the opt-in flag.
    await expect(repository.register({ deviceId: LEGACY_ID, platform: "android" })).rejects.toBeInstanceOf(DeviceAuthFailedError);
    const second = await repository.register({
      deviceId: LEGACY_ID,
      platform: "android",
      appVersion: "1.1",
      deviceSecret: first.deviceSecret,
    });
    expect(second).toEqual({ deviceId: LEGACY_ID, registered: true });
    expect(records.get(LEGACY_ID)).toMatchObject({ secretHash: storedHash, appVersion: "1.1" });
  });

  it("rejects a legacy claim lost to a concurrent register", async () => {
    const { prisma } = seededRepository();
    prisma.device.updateMany = async () => ({ count: 0 });
    const repository = new DeviceRepository(prisma as never);

    await expect(
      repository.register({ deviceId: LEGACY_ID, platform: "android", deviceSecretSupported: true }),
    ).rejects.toBeInstanceOf(DeviceAuthFailedError);
  });

  it("rejects a create lost to a concurrent register", async () => {
    const { prisma } = seededRepository();
    prisma.device.findUnique = async () => null;
    const repository = new DeviceRepository(prisma as never);

    await expect(
      repository.register({ deviceId: LEGACY_ID, platform: "android", deviceSecretSupported: true }),
    ).rejects.toBeInstanceOf(DeviceAuthFailedError);
  });

  it("issues no secret to clients that do not opt in", async () => {
    const { prisma, records } = seededRepository();
    const repository = new DeviceRepository(prisma as never, () => new Date(), () => "device-old-app");

    const fresh = await repository.register({ platform: "android" });
    const legacy = await repository.register({ deviceId: LEGACY_ID, platform: "android", appVersion: "0.9" });

    expect(fresh).toEqual({ deviceId: "device-old-app", registered: true });
    expect(legacy).toEqual({ deviceId: LEGACY_ID, registered: true });
    expect(records.get("device-old-app")?.secretHash ?? null).toBeNull();
    expect(records.get(LEGACY_ID)).toMatchObject({ secretHash: null, appVersion: "0.9" });
  });

  it("verifies secrets by device id", async () => {
    const { repository } = seededRepository();
    await expect(repository.verifyDeviceSecret(SECURED_ID, SECURED_SECRET)).resolves.toBe("ok");
    await expect(repository.verifyDeviceSecret(SECURED_ID, "nope")).resolves.toBe("mismatch");
    await expect(repository.verifyDeviceSecret(LEGACY_ID, undefined)).resolves.toBe("legacy");
    await expect(repository.verifyDeviceSecret("device-unknown", undefined)).resolves.toBe("missing");
  });
});

async function buildSecuredApp() {
  const { repository, records } = seededRepository();
  const snapshot = { preferences: [], revision: 0, updatedAt: "2026-10-20T00:00:00.000Z" };
  const bootstrap = new BootstrapService({
    catalog: { getGenerations: () => [], getMembers: () => [] },
    devices: repository,
    preferences: { listForDevice: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    hubEvents: { summary: () => ({ activeCount: 0, items: [] }) as never },
  });
  const app = await buildApp({
    env: { DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub" },
    useProcessEnv: false,
    appRoutes: {
      dependencies: {
        devices: repository,
        bootstrap,
        preferences: {
          getSnapshotForDevice: async () => snapshot,
          replaceForDevice: async () => ({ ...snapshot, revision: 1 }),
        },
      },
    },
  });
  return { app, records };
}

const protectedRoutes = [
  { name: "GET /v1/bootstrap", request: (deviceId: string) => ({ method: "GET" as const, url: `/v1/bootstrap?deviceId=${deviceId}` }) },
  { name: "GET /v1/preferences", request: (deviceId: string) => ({ method: "GET" as const, url: `/v1/preferences?deviceId=${deviceId}` }) },
  {
    name: "PUT /v1/preferences",
    request: (deviceId: string) => ({ method: "PUT" as const, url: "/v1/preferences", payload: { deviceId, preferences: [], expectedRevision: 0 } }),
  },
  {
    name: "PUT /v1/devices/token",
    request: (deviceId: string) => ({
      method: "PUT" as const,
      url: "/v1/devices/token",
      payload: { deviceId, platform: "android", provider: "fcm", token: `token-${deviceId}` },
    }),
  },
  {
    name: "POST /v1/devices/register",
    request: (deviceId: string) => ({ method: "POST" as const, url: "/v1/devices/register", payload: { deviceId, platform: "android" } }),
  },
];

describe("device secret route enforcement", () => {
  it.each(protectedRoutes)("$name: legacy ok, correct secret ok, wrong or missing secret 401", async (route) => {
    const { app } = await buildSecuredApp();
    try {
      const legacy = await app.inject(route.request(LEGACY_ID));
      const correct = await app.inject({ ...route.request(SECURED_ID), headers: { "x-device-secret": SECURED_SECRET } });
      const wrong = await app.inject({ ...route.request(SECURED_ID), headers: { "x-device-secret": "wrong" } });
      const missing = await app.inject(route.request(SECURED_ID));

      expect(legacy.statusCode).toBe(200);
      expect(correct.statusCode).toBe(200);
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json()).toEqual({ error: "device_auth_failed" });
      expect(missing.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns a deviceSecret only when one is issued", async () => {
    const { app, records } = await buildSecuredApp();
    try {
      const fresh = await app.inject({
        method: "POST",
        url: "/v1/devices/register",
        payload: { platform: "android", deviceSecretSupported: true },
      });
      const claimed = await app.inject({
        method: "POST",
        url: "/v1/devices/register",
        payload: { deviceId: LEGACY_ID, platform: "android", deviceSecretSupported: true },
      });
      const refreshed = await app.inject({
        method: "POST",
        url: "/v1/devices/register",
        headers: { "x-device-secret": SECURED_SECRET },
        payload: { deviceId: SECURED_ID, platform: "android" },
      });

      expect(fresh.json().deviceSecret).toEqual(expect.any(String));
      expect(records.get(fresh.json().deviceId)?.secretHash).toBe(hashDeviceSecret(fresh.json().deviceSecret));
      expect(claimed.json().deviceSecret).toEqual(expect.any(String));
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json()).not.toHaveProperty("deviceSecret");
    } finally {
      await app.close();
    }
  });

  it("keeps old clients (no opt-in flag) working without a secret", async () => {
    const { app, records } = await buildSecuredApp();
    try {
      const fresh = await app.inject({ method: "POST", url: "/v1/devices/register", payload: { platform: "android" } });
      const legacy = await app.inject({ method: "POST", url: "/v1/devices/register", payload: { deviceId: LEGACY_ID, platform: "android" } });
      const truthy = await app.inject({
        method: "POST",
        url: "/v1/devices/register",
        payload: { deviceId: LEGACY_ID, platform: "android", deviceSecretSupported: "true" },
      });
      expect([fresh, legacy, truthy].map((response) => response.statusCode)).toEqual([200, 200, 200]);
      for (const response of [fresh, legacy, truthy]) expect(response.json()).not.toHaveProperty("deviceSecret");
      expect(records.get(LEGACY_ID)?.secretHash).toBeNull();

      for (const deviceId of [fresh.json().deviceId as string, LEGACY_ID]) {
        for (const route of protectedRoutes) {
          expect((await app.inject(route.request(deviceId))).statusCode, `${route.name} ${deviceId}`).toBe(200);
        }
      }
    } finally {
      await app.close();
    }
  });

  it("keeps unknown devices on the pre-secret behaviour for token updates", async () => {
    const { app } = await buildSecuredApp();
    try {
      const response = await app.inject(protectedRoutes[3]!.request("device-unknown"));
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

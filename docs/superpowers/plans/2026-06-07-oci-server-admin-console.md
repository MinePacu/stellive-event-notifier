# OCI Server Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight authenticated admin console and internal management API for the OCI-hosted Stellive Notification Hub backend.

**Architecture:** The console is embedded in the existing Fastify backend and is disabled by default. The browser UI at `/admin` calls authenticated `/v1/internal/*` JSON endpoints that read operational state and trigger only bounded, policy-preserving backend actions. Console actions use existing backend boundaries and never bypass event guards, preference resolution, load reduction, or push policy.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma, PostgreSQL, Vitest, plain HTML/CSS/JavaScript, Docker-compatible environment variables.

---

## Spec Reference

Design document: `docs/superpowers/specs/2026-06-07-oci-server-admin-console-design.md`

## File Structure

- Create: `backend/stellive-hub-api/src/admin/adminAuth.ts`  
  Validates bearer tokens and admin session cookies without logging secrets.
- Create: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`  
  Returns dependency-free HTML, CSS, and small browser-side JavaScript for `/admin`.
- Create: `backend/stellive-hub-api/src/admin/adminHealthService.ts`  
  Builds redacted overview data from environment flags and repositories.
- Create: `backend/stellive-hub-api/src/admin/adminTypes.ts`  
  Defines stable DTOs for the admin console and internal API.
- Create: `backend/stellive-hub-api/src/routes/adminRoutes.ts`  
  Registers `/admin` routes when enabled.
- Create: `backend/stellive-hub-api/src/routes/internalRoutes.ts`  
  Registers authenticated `/v1/internal/*` routes.
- Create: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`  
  Reads redacted delivery diagnostics.
- Create: `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`  
  Reads live status cache diagnostics.
- Create: `backend/stellive-hub-api/src/repositories/webhookSubscriptionRepository.ts`  
  Reads WebSub subscription diagnostics.
- Create: `backend/stellive-hub-api/test/adminAuth.test.ts`  
  Covers env parsing and token authentication behavior.
- Create: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`  
  Covers route auth, redaction, and disabled-action behavior.
- Modify: `backend/stellive-hub-api/src/config/env.ts`  
  Add admin console flags and token validation.
- Modify: `backend/stellive-hub-api/src/app.ts`  
  Register admin and internal route modules.
- Modify: `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`  
  Add bounded diagnostic reads and queue summaries.
- Modify: `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts`  
  Add read methods for adapter health state.
- Modify: `backend/stellive-hub-api/.env.example`  
  Document new admin console variables with non-secret example names.
- Modify: `shared/openapi/openapi.yaml`  
  Add internal API route contracts.
- Modify: `docs/API_SETUP.md`  
  Add OCI admin console setup and access guidance.
- Modify: `docs/ARCHITECTURE.md`  
  Document the embedded console boundary.

## Task 1: Environment And Admin Authentication

**Files:**
- Create: `backend/stellive-hub-api/src/admin/adminAuth.ts`
- Create: `backend/stellive-hub-api/test/adminAuth.test.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`

- [ ] **Step 1: Write the failing auth and env tests**

Create `backend/stellive-hub-api/test/adminAuth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { authenticateBearerToken, getConfiguredSecretState, shouldEnableAdminConsole } from "../src/admin/adminAuth.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub"
};

describe("admin console environment", () => {
  it("keeps the admin console disabled by default", () => {
    const env = loadEnv(baseEnv);

    expect(env.ADMIN_CONSOLE_ENABLED).toBe(false);
    expect(shouldEnableAdminConsole(env)).toBe(false);
  });

  it("does not enable the admin console without an admin token", () => {
    const env = loadEnv({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "true" });

    expect(shouldEnableAdminConsole(env)).toBe(false);
  });

  it("enables the admin console when the flag and token are configured", () => {
    const env = loadEnv({
      ...baseEnv,
      ADMIN_CONSOLE_ENABLED: "true",
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    expect(shouldEnableAdminConsole(env)).toBe(true);
  });

  it("reports secret readiness without exposing values", () => {
    const state = getConfiguredSecretState({
      INTERNAL_API_TOKEN: "internal-token",
      ADMIN_CONSOLE_TOKEN: undefined,
      FCM_PRIVATE_KEY: "firebase-private-key"
    });

    expect(state).toEqual({
      INTERNAL_API_TOKEN: "configured",
      ADMIN_CONSOLE_TOKEN: "missing",
      FCM_PRIVATE_KEY: "configured"
    });
  });
});

describe("bearer token authentication", () => {
  it("accepts the expected bearer token", () => {
    expect(authenticateBearerToken("Bearer internal-token", "internal-token")).toEqual({ ok: true });
  });

  it("rejects missing tokens", () => {
    expect(authenticateBearerToken(undefined, "internal-token")).toEqual({
      ok: false,
      reason: "missing_authorization"
    });
  });

  it("rejects malformed authorization headers", () => {
    expect(authenticateBearerToken("Basic abc", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_authorization_scheme"
    });
  });

  it("rejects invalid bearer tokens", () => {
    expect(authenticateBearerToken("Bearer wrong-token", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_token"
    });
  });

  it("rejects requests when the expected token is not configured", () => {
    expect(authenticateBearerToken("Bearer internal-token", undefined)).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
  });
});
```

- [ ] **Step 2: Run the auth tests to verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminAuth
```

Expected: FAIL because `../src/admin/adminAuth.js` does not exist and `ADMIN_CONSOLE_ENABLED` is not defined by `loadEnv`.

- [ ] **Step 3: Add admin environment variables**

Modify `backend/stellive-hub-api/src/config/env.ts`:

```ts
const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  YOUTUBE_WEBSUB_CALLBACK_URL: z.string().optional(),
  YOUTUBE_WEBSUB_VERIFY_TOKEN: z.string().optional(),
  YOUTUBE_WEBSUB_ENABLED: booleanFlag(true),
  YOUTUBE_DATA_API_FALLBACK_ENABLED: booleanFlag(false),
  X_BEARER_TOKEN: z.string().optional(),
  X_API_COST_POLICY: z.literal("no_paid_api").default("no_paid_api"),
  X_FREE_API_ENABLED: booleanFlag(false),
  X_FREE_STREAM_ENABLED: booleanFlag(false),
  X_FREE_POLLING_ENABLED: booleanFlag(false),
  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),
  NAVER_CAFE_SEARCH_ENABLED: booleanFlag(false),
  CHZZK_CLIENT_ID: z.string().optional(),
  CHZZK_CLIENT_SECRET: z.string().optional(),
  CHZZK_ACCESS_TOKEN: z.string().optional(),
  CHZZK_REFRESH_TOKEN: z.string().optional(),
  CHZZK_LIVE_POLLING_ENABLED: booleanFlag(false),
  DB_NOTIFICATION_QUEUE_ENABLED: booleanFlag(true),
  FOREGROUND_SSE_ENABLED: booleanFlag(false),
  INTERNAL_API_TOKEN: z.string().optional(),
  ADMIN_CONSOLE_ENABLED: booleanFlag(false),
  ADMIN_CONSOLE_TOKEN: z.string().optional()
});
```

- [ ] **Step 4: Implement admin auth helpers**

Create `backend/stellive-hub-api/src/admin/adminAuth.ts`:

```ts
import type { AppEnv } from "../config/env.js";

export type AuthFailureReason =
  | "missing_authorization"
  | "invalid_authorization_scheme"
  | "invalid_token"
  | "token_not_configured";

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailureReason };

export type SecretReadiness = "configured" | "missing";

export function shouldEnableAdminConsole(env: Pick<AppEnv, "ADMIN_CONSOLE_ENABLED" | "ADMIN_CONSOLE_TOKEN">): boolean {
  return env.ADMIN_CONSOLE_ENABLED && typeof env.ADMIN_CONSOLE_TOKEN === "string" && env.ADMIN_CONSOLE_TOKEN.length > 0;
}

export function authenticateBearerToken(authorizationHeader: string | undefined, expectedToken: string | undefined): AuthResult {
  if (!expectedToken) return { ok: false, reason: "token_not_configured" };
  if (!authorizationHeader) return { ok: false, reason: "missing_authorization" };

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) return { ok: false, reason: "invalid_authorization_scheme" };

  return token === expectedToken ? { ok: true } : { ok: false, reason: "invalid_token" };
}

export function getConfiguredSecretState(input: Record<string, string | undefined>): Record<string, SecretReadiness> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value && value.length > 0 ? "configured" : "missing"])
  );
}
```

- [ ] **Step 5: Add env examples**

Modify `backend/stellive-hub-api/.env.example` by appending:

```env
ADMIN_CONSOLE_ENABLED=false
ADMIN_CONSOLE_TOKEN=replace_with_admin_console_token
```

- [ ] **Step 6: Run the auth tests to verify they pass**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminAuth
```

Expected: PASS for all tests in `adminAuth.test.ts`.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/src/admin/adminAuth.ts backend/stellive-hub-api/test/adminAuth.test.ts backend/stellive-hub-api/.env.example
git commit -m "feat: add admin console authentication"
```

## Task 2: Admin DTOs, Repository Reads, And Overview Service

**Files:**
- Create: `backend/stellive-hub-api/src/admin/adminTypes.ts`
- Create: `backend/stellive-hub-api/src/admin/adminHealthService.ts`
- Create: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- Create: `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`
- Create: `backend/stellive-hub-api/src/repositories/webhookSubscriptionRepository.ts`
- Modify: `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts`

- [ ] **Step 1: Add the shared admin DTO types**

Create `backend/stellive-hub-api/src/admin/adminTypes.ts`:

```ts
import type { SecretReadiness } from "./adminAuth.js";

export type AdminHealthStatus = "ok" | "degraded" | "disabled" | "verify_required" | "rate_limited";
export type AdapterHealthStatus = "enabled" | "disabled" | "verify_required" | "rate_limited";

export interface AdapterHealth {
  source: "youtube" | "chzzk" | "x" | "naver_cafe";
  status: AdapterHealthStatus;
  reason: string;
  lastCheckedAt: string;
}

export interface NotificationJobSummary {
  queued: number;
  locked: number;
  completed: number;
  failed: number;
  oldestQueuedAt?: string;
}

export interface NotificationJobDiagnostic {
  id: string;
  eventId: string;
  priority: number;
  status: string;
  runAfter: string;
  lockedAt?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSubscriptionDiagnostic {
  id: string;
  source: string;
  targetId: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
}

export interface LiveStatusDiagnostic {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title?: string;
  viewerCount?: number;
  startedAt?: string;
  platformUrl?: string;
  lastCheckedAt: string;
  sourceVerificationState: string;
}

export interface DeliveryAttemptDiagnostic {
  id: string;
  eventId: string;
  attemptedAt: string;
  deliveredAt?: string;
  status: string;
  reason?: string;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  deliveryMode: string;
  deliveryLevel?: string;
  pushPriority: string;
  providerErrorCode?: string;
}

export interface AdminOverview {
  service: {
    name: "stellive-hub-api";
    environment: string;
    uptimeSeconds: number;
  };
  database: {
    status: AdminHealthStatus;
    reason: string;
  };
  featureFlags: Record<string, boolean | string>;
  secrets: Record<string, SecretReadiness>;
  queue: NotificationJobSummary;
  adapters: AdapterHealth[];
  recentDelivery: {
    sent: number;
    queued: number;
    skipped: number;
    failed: number;
  };
}
```

- [ ] **Step 2: Extend `NotificationJobRepository` with diagnostics**

Modify `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`:

```ts
import { getPrismaClient } from "../storage/prisma.js";
import type { NotificationJobDiagnostic, NotificationJobSummary } from "../admin/adminTypes.js";

interface NotificationJobRecord {
  id: string;
  eventId: string;
  priority: number;
  status: string;
  runAfter: Date;
  lockedAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationJobDelegate {
  notificationJob: {
    create(args: { data: { eventId: string; priority: number; status: string } }): Promise<unknown>;
    groupBy(args: { by: ["status"]; _count: { status: true } }): Promise<Array<{ status: string; _count: { status: number } }>>;
    findFirst(args: { where: { status: string }; orderBy: { runAfter: "asc" } }): Promise<{ runAfter: Date } | null>;
    findMany(args: {
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<NotificationJobRecord[]>;
  };
}

export interface EnqueueNotificationJobInput {
  eventId: string;
  priority: number;
}

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function toDiagnostic(record: NotificationJobRecord): NotificationJobDiagnostic {
  return {
    id: record.id,
    eventId: record.eventId,
    priority: record.priority,
    status: record.status,
    runAfter: record.runAfter.toISOString(),
    lockedAt: toIso(record.lockedAt),
    attempts: record.attempts,
    lastError: record.lastError ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class NotificationJobRepository {
  constructor(private readonly prisma: NotificationJobDelegate = getPrismaClient()) {}

  async enqueue(input: EnqueueNotificationJobInput) {
    return this.prisma.notificationJob.create({
      data: {
        eventId: input.eventId,
        priority: input.priority,
        status: "queued"
      }
    });
  }

  async summarize(): Promise<NotificationJobSummary> {
    const grouped = await this.prisma.notificationJob.groupBy({ by: ["status"], _count: { status: true } });
    const oldestQueued = await this.prisma.notificationJob.findFirst({
      where: { status: "queued" },
      orderBy: { runAfter: "asc" }
    });
    const byStatus = new Map(grouped.map((item) => [item.status, item._count.status]));

    return {
      queued: byStatus.get("queued") ?? 0,
      locked: byStatus.get("locked") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      failed: byStatus.get("failed") ?? 0,
      oldestQueuedAt: oldestQueued?.runAfter.toISOString()
    };
  }

  async listDiagnostics(limit = 25): Promise<NotificationJobDiagnostic[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const records = await this.prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: safeLimit
    });
    return records.map(toDiagnostic);
  }
}
```

- [ ] **Step 3: Extend `PlatformApiStateRepository` with adapter health reads**

Modify `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts`:

```ts
import type { Prisma } from "@prisma/client";
import type { AdapterHealth } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface PlatformApiStateRecord {
  source: string;
  key: string;
  value: Prisma.JsonValue;
  status: string;
  updatedAt: Date;
}

interface PlatformApiStateDelegate {
  platformApiState: {
    upsert(args: {
      where: { source_key: { source: string; key: string } };
      create: { source: string; key: string; value: Prisma.InputJsonValue; status: string };
      update: { value: Prisma.InputJsonValue; status: string };
    }): Promise<unknown>;
    findMany(args?: { orderBy?: { updatedAt: "desc" } }): Promise<PlatformApiStateRecord[]>;
  };
}

export interface PlatformApiStateInput {
  source: string;
  key: string;
  value: Prisma.InputJsonValue;
  status: string;
}

function reasonFromValue(value: Prisma.JsonValue): string {
  if (value && typeof value === "object" && !Array.isArray(value) && "reason" in value) {
    const reason = value.reason;
    return typeof reason === "string" ? reason : "state_recorded";
  }
  return "state_recorded";
}

export class PlatformApiStateRepository {
  constructor(private readonly prisma: PlatformApiStateDelegate = getPrismaClient()) {}

  async upsert(input: PlatformApiStateInput) {
    return this.prisma.platformApiState.upsert({
      where: { source_key: { source: input.source, key: input.key } },
      create: {
        source: input.source,
        key: input.key,
        value: input.value,
        status: input.status
      },
      update: {
        value: input.value,
        status: input.status
      }
    });
  }

  async listAdapterHealth(): Promise<AdapterHealth[]> {
    const records = await this.prisma.platformApiState.findMany({ orderBy: { updatedAt: "desc" } });
    return records
      .filter((record) => ["youtube", "chzzk", "x", "naver_cafe"].includes(record.source))
      .map((record) => ({
        source: record.source as AdapterHealth["source"],
        status: record.status as AdapterHealth["status"],
        reason: reasonFromValue(record.value),
        lastCheckedAt: record.updatedAt.toISOString()
      }));
  }
}
```

- [ ] **Step 4: Add delivery, live status, and subscription repositories**

Create `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`:

```ts
import type { DeliveryAttemptDiagnostic } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface DeliveryAttemptRecord {
  id: string;
  eventId: string;
  attemptedAt: Date;
  deliveredAt: Date | null;
  status: string;
  reason: string | null;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  deliveryMode: string;
  deliveryLevel: string | null;
  pushPriority: string;
  providerErrorCode: string | null;
}

interface DeliveryAttemptDelegate {
  deliveryAttempt: {
    findMany(args: {
      orderBy: { attemptedAt: "desc" };
      take: number;
    }): Promise<DeliveryAttemptRecord[]>;
    groupBy(args: { by: ["status"]; _count: { status: true } }): Promise<Array<{ status: string; _count: { status: number } }>>;
  };
}

function toDiagnostic(record: DeliveryAttemptRecord): DeliveryAttemptDiagnostic {
  return {
    id: record.id,
    eventId: record.eventId,
    attemptedAt: record.attemptedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    status: record.status,
    reason: record.reason ?? undefined,
    source: record.source,
    eventType: record.eventType,
    generationId: record.generationId,
    memberId: record.memberId,
    deliveryMode: record.deliveryMode,
    deliveryLevel: record.deliveryLevel ?? undefined,
    pushPriority: record.pushPriority,
    providerErrorCode: record.providerErrorCode ?? undefined
  };
}

export class DeliveryAttemptRepository {
  constructor(private readonly prisma: DeliveryAttemptDelegate = getPrismaClient()) {}

  async listRecent(limit = 25): Promise<DeliveryAttemptDiagnostic[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const records = await this.prisma.deliveryAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: safeLimit
    });
    return records.map(toDiagnostic);
  }

  async summarizeRecent() {
    const grouped = await this.prisma.deliveryAttempt.groupBy({ by: ["status"], _count: { status: true } });
    const byStatus = new Map(grouped.map((item) => [item.status, item._count.status]));
    return {
      sent: byStatus.get("sent") ?? 0,
      queued: byStatus.get("queued") ?? 0,
      skipped: byStatus.get("skipped") ?? 0,
      failed: byStatus.get("failed") ?? 0
    };
  }
}
```

Create `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`:

```ts
import type { LiveStatusDiagnostic } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface LiveStatusRecord {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  startedAt: Date | null;
  platformUrl: string | null;
  lastCheckedAt: Date;
  sourceVerificationState: string;
}

interface LiveStatusDelegate {
  liveStatus: {
    findMany(args: { orderBy: { lastCheckedAt: "desc" }; take: number }): Promise<LiveStatusRecord[]>;
  };
}

function toDiagnostic(record: LiveStatusRecord): LiveStatusDiagnostic {
  return {
    memberId: record.memberId,
    generationId: record.generationId,
    isLive: record.isLive,
    title: record.title ?? undefined,
    viewerCount: record.viewerCount ?? undefined,
    startedAt: record.startedAt?.toISOString(),
    platformUrl: record.platformUrl ?? undefined,
    lastCheckedAt: record.lastCheckedAt.toISOString(),
    sourceVerificationState: record.sourceVerificationState
  };
}

export class LiveStatusRepository {
  constructor(private readonly prisma: LiveStatusDelegate = getPrismaClient()) {}

  async listDiagnostics(limit = 50): Promise<LiveStatusDiagnostic[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const records = await this.prisma.liveStatus.findMany({
      orderBy: { lastCheckedAt: "desc" },
      take: safeLimit
    });
    return records.map(toDiagnostic);
  }
}
```

Create `backend/stellive-hub-api/src/repositories/webhookSubscriptionRepository.ts`:

```ts
import type { WebhookSubscriptionDiagnostic } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface WebhookSubscriptionRecord {
  id: string;
  source: string;
  targetId: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt: Date | null;
  lastVerifiedAt: Date | null;
  lastError: string | null;
}

interface WebhookSubscriptionDelegate {
  webhookSubscription: {
    findMany(args: { orderBy: { updatedAt: "desc" }; take: number }): Promise<WebhookSubscriptionRecord[]>;
  };
}

function toDiagnostic(record: WebhookSubscriptionRecord): WebhookSubscriptionDiagnostic {
  return {
    id: record.id,
    source: record.source,
    targetId: record.targetId,
    topicUrl: record.topicUrl,
    status: record.status,
    leaseExpiresAt: record.leaseExpiresAt?.toISOString(),
    lastVerifiedAt: record.lastVerifiedAt?.toISOString(),
    lastError: record.lastError ?? undefined
  };
}

export class WebhookSubscriptionRepository {
  constructor(private readonly prisma: WebhookSubscriptionDelegate = getPrismaClient()) {}

  async listDiagnostics(limit = 50): Promise<WebhookSubscriptionDiagnostic[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const records = await this.prisma.webhookSubscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: safeLimit
    });
    return records.map(toDiagnostic);
  }
}
```

- [ ] **Step 5: Add the overview service**

Create `backend/stellive-hub-api/src/admin/adminHealthService.ts`:

```ts
import type { AppEnv } from "../config/env.js";
import { loadEnv } from "../config/env.js";
import { getConfiguredSecretState } from "./adminAuth.js";
import type { AdapterHealth, AdminOverview } from "./adminTypes.js";
import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import { PlatformApiStateRepository } from "../repositories/platformApiStateRepository.js";
import { getPrismaClient } from "../storage/prisma.js";

const defaultAdapterHealth: AdapterHealth[] = [
  { source: "youtube", status: "disabled", reason: "youtube_websub_disabled", lastCheckedAt: new Date(0).toISOString() },
  { source: "chzzk", status: "verify_required", reason: "chzzk_allowed_api_not_confirmed", lastCheckedAt: new Date(0).toISOString() },
  { source: "x", status: "disabled", reason: "x_no_free_official_api", lastCheckedAt: new Date(0).toISOString() },
  { source: "naver_cafe", status: "disabled", reason: "naver_cafe_search_disabled", lastCheckedAt: new Date(0).toISOString() }
];

export class AdminHealthService {
  constructor(
    private readonly env: AppEnv = loadEnv(),
    private readonly jobs = new NotificationJobRepository(),
    private readonly deliveryAttempts = new DeliveryAttemptRepository(),
    private readonly platformApiState = new PlatformApiStateRepository(),
    private readonly prisma = getPrismaClient()
  ) {}

  async overview(): Promise<AdminOverview> {
    const [queue, recentDelivery, adapterState, database] = await Promise.all([
      this.readQueueSummary(),
      this.readRecentDeliverySummary(),
      this.readAdapterHealth(),
      this.databaseStatus()
    ]);

    const adapterBySource = new Map(adapterState.map((item) => [item.source, item]));

    return {
      service: {
        name: "stellive-hub-api",
        environment: this.env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime())
      },
      database,
      featureFlags: {
        YOUTUBE_WEBSUB_ENABLED: this.env.YOUTUBE_WEBSUB_ENABLED,
        YOUTUBE_DATA_API_FALLBACK_ENABLED: this.env.YOUTUBE_DATA_API_FALLBACK_ENABLED,
        X_API_COST_POLICY: this.env.X_API_COST_POLICY,
        X_FREE_API_ENABLED: this.env.X_FREE_API_ENABLED,
        X_FREE_STREAM_ENABLED: this.env.X_FREE_STREAM_ENABLED,
        X_FREE_POLLING_ENABLED: this.env.X_FREE_POLLING_ENABLED,
        NAVER_CAFE_SEARCH_ENABLED: this.env.NAVER_CAFE_SEARCH_ENABLED,
        CHZZK_LIVE_POLLING_ENABLED: this.env.CHZZK_LIVE_POLLING_ENABLED,
        DB_NOTIFICATION_QUEUE_ENABLED: this.env.DB_NOTIFICATION_QUEUE_ENABLED,
        FOREGROUND_SSE_ENABLED: this.env.FOREGROUND_SSE_ENABLED,
        ADMIN_CONSOLE_ENABLED: this.env.ADMIN_CONSOLE_ENABLED
      },
      secrets: getConfiguredSecretState({
        DATABASE_URL: this.env.DATABASE_URL,
        INTERNAL_API_TOKEN: this.env.INTERNAL_API_TOKEN,
        ADMIN_CONSOLE_TOKEN: this.env.ADMIN_CONSOLE_TOKEN,
        FCM_PROJECT_ID: this.env.FCM_PROJECT_ID,
        FCM_CLIENT_EMAIL: this.env.FCM_CLIENT_EMAIL,
        FCM_PRIVATE_KEY: this.env.FCM_PRIVATE_KEY,
        YOUTUBE_API_KEY: this.env.YOUTUBE_API_KEY,
        YOUTUBE_WEBSUB_CALLBACK_URL: this.env.YOUTUBE_WEBSUB_CALLBACK_URL,
        YOUTUBE_WEBSUB_VERIFY_TOKEN: this.env.YOUTUBE_WEBSUB_VERIFY_TOKEN,
        X_BEARER_TOKEN: this.env.X_BEARER_TOKEN,
        NAVER_CLIENT_ID: this.env.NAVER_CLIENT_ID,
        NAVER_CLIENT_SECRET: this.env.NAVER_CLIENT_SECRET,
        CHZZK_CLIENT_ID: this.env.CHZZK_CLIENT_ID,
        CHZZK_CLIENT_SECRET: this.env.CHZZK_CLIENT_SECRET,
        CHZZK_ACCESS_TOKEN: this.env.CHZZK_ACCESS_TOKEN,
        CHZZK_REFRESH_TOKEN: this.env.CHZZK_REFRESH_TOKEN
      }),
      queue,
      adapters: defaultAdapterHealth.map((fallback) => adapterBySource.get(fallback.source) ?? fallback),
      recentDelivery
    };
  }

  private async readQueueSummary(): Promise<AdminOverview["queue"]> {
    try {
      return await this.jobs.summarize();
    } catch {
      return { queued: 0, locked: 0, completed: 0, failed: 0 };
    }
  }

  private async readRecentDeliverySummary(): Promise<AdminOverview["recentDelivery"]> {
    try {
      return await this.deliveryAttempts.summarizeRecent();
    } catch {
      return { sent: 0, queued: 0, skipped: 0, failed: 0 };
    }
  }

  private async readAdapterHealth(): Promise<AdapterHealth[]> {
    try {
      return await this.platformApiState.listAdapterHealth();
    } catch {
      return [];
    }
  }

  private async databaseStatus(): Promise<AdminOverview["database"]> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", reason: "database_ready" };
    } catch {
      return { status: "degraded", reason: "database_unavailable" };
    }
  }
}
```

- [ ] **Step 6: Run typecheck and focused tests**

Run:

```bash
cd backend/stellive-hub-api
npm run build
npm test -- adminAuth
```

Expected: build passes and `adminAuth` tests still pass.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add backend/stellive-hub-api/src/admin/adminTypes.ts backend/stellive-hub-api/src/admin/adminHealthService.ts backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts backend/stellive-hub-api/src/repositories/liveStatusRepository.ts backend/stellive-hub-api/src/repositories/webhookSubscriptionRepository.ts backend/stellive-hub-api/src/jobs/notificationJobRepository.ts backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts
git commit -m "feat: add admin diagnostics services"
```

## Task 3: Authenticated Internal Routes

**Files:**
- Create: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Create: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`

- [ ] **Step 1: Write failing route tests**

Create `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("internal admin routes", () => {
  it("rejects missing internal tokens", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        INTERNAL_API_TOKEN: "internal-token"
      }
    });

    const response = await app.inject({ method: "GET", url: "/v1/internal/adapters/health" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_authorization" });
  });

  it("rejects invalid internal tokens", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        INTERNAL_API_TOKEN: "internal-token"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { authorization: "Bearer wrong-token" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns default adapter health with a valid internal token", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        INTERNAL_API_TOKEN: "internal-token"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { authorization: "Bearer internal-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "x", status: "disabled", reason: "x_no_free_official_api" })
      ])
    );
  });

  it("returns bounded disabled scheduler results when CHZZK polling is off", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        INTERNAL_API_TOKEN: "internal-token",
        CHZZK_LIVE_POLLING_ENABLED: "false"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: { authorization: "Bearer internal-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "disabled", reason: "chzzk_live_polling_disabled" });
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL because `buildApp` does not accept injected env and `internalRoutes.ts` does not exist.

- [ ] **Step 3: Allow `buildApp` to receive test environment overrides**

Modify `backend/stellive-hub-api/src/app.ts`:

```ts
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import { registerInternalRoutes } from "./routes/internalRoutes.js";
import { registerRoutes } from "./routes/routes.js";

export interface BuildAppOptions {
  env?: Partial<Record<keyof AppEnv, string | boolean | number | undefined>> & { DATABASE_URL: string };
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = loadEnv(options.env ? { ...process.env, ...options.env } : process.env);
  const app = Fastify({ logger: true });
  await app.register(cors);
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Stellive Notification Hub API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await registerRoutes(app);
  await registerInternalRoutes(app, { env });
  await registerAdminRoutes(app, { env });
  return app;
}
```

- [ ] **Step 4: Implement authenticated internal routes**

Create `backend/stellive-hub-api/src/routes/internalRoutes.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "../config/env.js";
import { authenticateBearerToken } from "../admin/adminAuth.js";
import { AdminHealthService } from "../admin/adminHealthService.js";
import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import { LiveStatusRepository } from "../repositories/liveStatusRepository.js";
import { WebhookSubscriptionRepository } from "../repositories/webhookSubscriptionRepository.js";

interface InternalRouteOptions {
  env: AppEnv;
}

function parseLimit(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : defaultValue;
}

function authorizationHeader(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return Array.isArray(header) ? header[0] : header;
}

export async function registerInternalRoutes(app: FastifyInstance, options: InternalRouteOptions) {
  const requireInternalAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = authenticateBearerToken(authorizationHeader(request), options.env.INTERNAL_API_TOKEN);
    if (!auth.ok) return reply.code(401).send({ error: auth.reason });
  };

  app.get("/v1/internal/admin/overview", { preHandler: requireInternalAuth }, async () => {
    return new AdminHealthService(options.env).overview();
  });

  app.get("/v1/internal/adapters/health", { preHandler: requireInternalAuth }, async () => {
    const overview = await new AdminHealthService(options.env).overview();
    return overview.adapters;
  });

  app.get("/v1/internal/jobs/notifications", { preHandler: requireInternalAuth }, async (request) => {
    const limit = parseLimit((request.query as { limit?: string | number }).limit, 25);
    return new NotificationJobRepository().listDiagnostics(limit);
  });

  app.post("/v1/internal/jobs/notifications/drain", { preHandler: requireInternalAuth }, async (request) => {
    const limit = parseLimit((request.body as { limit?: number } | undefined)?.limit, 25);
    return { status: "disabled", reason: "notification_worker_not_available", requestedLimit: limit };
  });

  app.get("/v1/internal/webhooks/subscriptions", { preHandler: requireInternalAuth }, async (request) => {
    const limit = parseLimit((request.query as { limit?: string | number }).limit, 50);
    return new WebhookSubscriptionRepository().listDiagnostics(limit);
  });

  app.post("/v1/internal/schedulers/youtube/renew-subscriptions", { preHandler: requireInternalAuth }, async () => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) return { status: "disabled", reason: "youtube_websub_disabled" };
    return { status: "disabled", reason: "youtube_subscription_worker_not_available" };
  });

  app.post("/v1/internal/schedulers/chzzk/live-status", { preHandler: requireInternalAuth }, async () => {
    if (!options.env.CHZZK_LIVE_POLLING_ENABLED) return { status: "disabled", reason: "chzzk_live_polling_disabled" };
    return { status: "verify_required", reason: "chzzk_allowed_api_not_confirmed" };
  });

  app.get("/v1/internal/live-status", { preHandler: requireInternalAuth }, async (request) => {
    const limit = parseLimit((request.query as { limit?: string | number }).limit, 50);
    return new LiveStatusRepository().listDiagnostics(limit);
  });

  app.get("/v1/internal/delivery-attempts", { preHandler: requireInternalAuth }, async (request) => {
    const limit = parseLimit((request.query as { limit?: string | number }).limit, 25);
    return new DeliveryAttemptRepository().listRecent(limit);
  });
}
```

- [ ] **Step 5: Run the route tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS for all internal route tests.

- [ ] **Step 6: Run the build**

Run:

```bash
cd backend/stellive-hub-api
npm run build
```

Expected: PASS. If the temporary pre-handler typing needs tightening, use the explicit `FastifyReply` version from Step 4.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/src/routes/internalRoutes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
git commit -m "feat: add authenticated internal admin routes"
```

## Task 4: Embedded Admin Console UI

**Files:**
- Create: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Create: `backend/stellive-hub-api/src/routes/adminRoutes.ts`
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add failing admin console route tests**

Append to `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`:

```ts
describe("admin console routes", () => {
  it("returns 404 when the admin console is disabled", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        ADMIN_CONSOLE_ENABLED: "false"
      }
    });

    const response = await app.inject({ method: "GET", url: "/admin" });

    expect(response.statusCode).toBe(404);
  });

  it("requires an admin token when enabled", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      }
    });

    const response = await app.inject({ method: "GET", url: "/admin" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_authorization" });
  });

  it("serves the admin console with a valid admin token", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { authorization: "Bearer admin-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Stellive Hub Admin");
    expect(response.body).toContain("/v1/internal/admin/overview");
  });
});
```

- [ ] **Step 2: Run tests to verify the console tests fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL because `adminRoutes.ts` and `adminConsoleHtml.ts` do not exist.

- [ ] **Step 3: Create the admin console HTML**

Create `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`:

```ts
export function renderAdminConsoleHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stellive Hub Admin</title>
  <style>
    :root {
      color-scheme: light;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #20242c;
    }
    body {
      margin: 0;
      min-height: 100vh;
    }
    header {
      border-bottom: 1px solid #d9dee7;
      background: #ffffff;
      padding: 16px 20px;
    }
    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 15px;
      margin: 0 0 12px;
      letter-spacing: 0;
    }
    .subtle {
      color: #657080;
      font-size: 13px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .panel {
      background: #ffffff;
      border: 1px solid #d9dee7;
      border-radius: 8px;
      padding: 14px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 7px 0;
      border-top: 1px solid #edf0f5;
      font-size: 13px;
    }
    .metric:first-of-type {
      border-top: 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border-radius: 999px;
      padding: 0 9px;
      font-size: 12px;
      font-weight: 600;
      background: #edf0f5;
      color: #313846;
      white-space: nowrap;
    }
    .pill.ok, .pill.enabled, .pill.configured {
      background: #dcefe4;
      color: #1f6b3d;
    }
    .pill.disabled, .pill.missing {
      background: #eceff3;
      color: #5c6675;
    }
    .pill.degraded, .pill.failed, .pill.rate_limited {
      background: #fde4df;
      color: #9b3322;
    }
    .pill.verify_required {
      background: #fff0cc;
      color: #805b00;
    }
    button {
      border: 1px solid #b8c0cc;
      background: #ffffff;
      color: #20242c;
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    button:hover {
      background: #f1f4f8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      border-top: 1px solid #edf0f5;
      padding: 8px 6px;
      vertical-align: top;
    }
    th {
      color: #657080;
      font-weight: 600;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }
    .error {
      color: #9b3322;
      font-size: 13px;
    }
    @media (max-width: 720px) {
      main {
        padding: 12px;
      }
      table {
        display: block;
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Stellive Hub Admin</h1>
    <div class="subtle">OCI lightweight server console</div>
  </header>
  <main>
    <div class="toolbar">
      <button id="refresh">Refresh</button>
      <button id="drain">Drain jobs</button>
      <button id="renew-youtube">Renew YouTube WebSub</button>
      <button id="poll-chzzk">Poll CHZZK live status</button>
    </div>
    <div id="error" class="error"></div>
    <section class="grid" id="overview"></section>
    <section class="panel" style="margin-top: 12px">
      <h2>Adapters</h2>
      <table>
        <thead><tr><th>Source</th><th>Status</th><th>Reason</th><th>Last checked</th></tr></thead>
        <tbody id="adapters"></tbody>
      </table>
    </section>
    <section class="panel" style="margin-top: 12px">
      <h2>Secrets Readiness</h2>
      <table>
        <thead><tr><th>Name</th><th>State</th></tr></thead>
        <tbody id="secrets"></tbody>
      </table>
    </section>
  </main>
  <script>
    const token = window.prompt("Admin token");
    const headers = { authorization: "Bearer " + token, "content-type": "application/json" };
    const error = document.getElementById("error");

    function pill(value) {
      return '<span class="pill ' + String(value).replaceAll("_", "-") + '">' + value + '</span>';
    }

    async function api(path, options) {
      const response = await fetch(path, { ...options, headers });
      if (!response.ok) throw new Error(path + " returned " + response.status);
      return response.json();
    }

    function renderOverview(data) {
      document.getElementById("overview").innerHTML = [
        ["Service", [["name", data.service.name], ["env", data.service.environment], ["uptime", data.service.uptimeSeconds + "s"]]],
        ["Database", [["status", pill(data.database.status)], ["reason", data.database.reason]]],
        ["Queue", Object.entries(data.queue)],
        ["Recent Delivery", Object.entries(data.recentDelivery)]
      ].map(([title, rows]) => {
        return '<section class="panel"><h2>' + title + '</h2>' + rows.map(([key, value]) => {
          return '<div class="metric"><span>' + key + '</span><strong>' + value + '</strong></div>';
        }).join("") + '</section>';
      }).join("");

      document.getElementById("adapters").innerHTML = data.adapters.map((adapter) => {
        return '<tr><td>' + adapter.source + '</td><td>' + pill(adapter.status) + '</td><td>' + adapter.reason + '</td><td>' + adapter.lastCheckedAt + '</td></tr>';
      }).join("");

      document.getElementById("secrets").innerHTML = Object.entries(data.secrets).map(([key, value]) => {
        return '<tr><td>' + key + '</td><td>' + pill(value) + '</td></tr>';
      }).join("");
    }

    async function refresh() {
      error.textContent = "";
      try {
        renderOverview(await api("/v1/internal/admin/overview"));
      } catch (event) {
        error.textContent = event.message;
      }
    }

    document.getElementById("refresh").addEventListener("click", refresh);
    document.getElementById("drain").addEventListener("click", async () => {
      await api("/v1/internal/jobs/notifications/drain", { method: "POST", body: JSON.stringify({ limit: 25 }) });
      await refresh();
    });
    document.getElementById("renew-youtube").addEventListener("click", async () => {
      await api("/v1/internal/schedulers/youtube/renew-subscriptions", { method: "POST" });
      await refresh();
    });
    document.getElementById("poll-chzzk").addEventListener("click", async () => {
      await api("/v1/internal/schedulers/chzzk/live-status", { method: "POST" });
      await refresh();
    });
    refresh();
  </script>
</body>
</html>`;
}
```

- [ ] **Step 4: Register `/admin` routes**

Create `backend/stellive-hub-api/src/routes/adminRoutes.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateBearerToken, shouldEnableAdminConsole } from "../admin/adminAuth.js";
import { renderAdminConsoleHtml } from "../admin/adminConsoleHtml.js";
import type { AppEnv } from "../config/env.js";

interface AdminRouteOptions {
  env: AppEnv;
}

function authorizationHeader(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return Array.isArray(header) ? header[0] : header;
}

export async function registerAdminRoutes(app: FastifyInstance, options: AdminRouteOptions) {
  app.get("/admin", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) return reply.notFound("admin console disabled");
    if (!shouldEnableAdminConsole(options.env)) return reply.code(503).send({ error: "admin_console_token_missing" });

    const auth = authenticateBearerToken(authorizationHeader(request), options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) return reply.code(401).send({ error: auth.reason });

    return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml());
  });
}
```

- [ ] **Step 5: Run console route tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS for internal route and console route tests.

- [ ] **Step 6: Run build**

Run:

```bash
cd backend/stellive-hub-api
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/src/routes/adminRoutes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
git commit -m "feat: add embedded admin console"
```

## Task 5: API Contract And Documentation

**Files:**
- Modify: `shared/openapi/openapi.yaml`
- Modify: `docs/API_SETUP.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Add OpenAPI path entries for internal routes**

Modify `shared/openapi/openapi.yaml` by adding path entries for:

```yaml
  /v1/internal/admin/overview:
    get:
      summary: Internal admin overview
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Redacted operational overview
        "401":
          description: Missing or invalid internal token
  /v1/internal/adapters/health:
    get:
      summary: Internal adapter health
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Adapter health list
        "401":
          description: Missing or invalid internal token
  /v1/internal/jobs/notifications:
    get:
      summary: Internal notification job diagnostics
      security:
        - internalBearerAuth: []
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            minimum: 1
            maximum: 100
      responses:
        "200":
          description: Bounded notification job diagnostics
  /v1/internal/jobs/notifications/drain:
    post:
      summary: Trigger bounded notification job drain
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Drain trigger result
  /v1/internal/webhooks/subscriptions:
    get:
      summary: Internal WebSub subscription diagnostics
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Webhook subscription diagnostics
  /v1/internal/schedulers/youtube/renew-subscriptions:
    post:
      summary: Trigger YouTube WebSub renewal
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Renewal trigger result
  /v1/internal/schedulers/chzzk/live-status:
    post:
      summary: Trigger CHZZK live status polling
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: CHZZK polling trigger result
  /v1/internal/live-status:
    get:
      summary: Internal live status diagnostics
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Live status diagnostics
  /v1/internal/delivery-attempts:
    get:
      summary: Internal delivery attempt diagnostics
      security:
        - internalBearerAuth: []
      responses:
        "200":
          description: Redacted delivery attempt diagnostics
```

Also add this security scheme under `components.securitySchemes` if it is not already present:

```yaml
    internalBearerAuth:
      type: http
      scheme: bearer
```

- [ ] **Step 2: Update API setup docs**

Add this section to `docs/API_SETUP.md`:

```md
## OCI Admin Console

The backend can serve a lightweight internal admin console at `/admin`. It is disabled by default and should be enabled only for controlled operation.

Required variables:

```env
ADMIN_CONSOLE_ENABLED=true
ADMIN_CONSOLE_TOKEN=replace_with_admin_console_token
INTERNAL_API_TOKEN=replace_with_internal_api_token
```

Recommended OCI access is through an SSH tunnel or private network path. Public internet exposure should use HTTPS and still requires the admin token.

The console displays operational readiness, adapter health, queue diagnostics, WebSub subscription state, live status cache, and redacted delivery attempts. It does not expose secrets, production device tokens, raw private platform responses, images, logos, or manual push sending.
```

- [ ] **Step 3: Update architecture docs**

Add this section to `docs/ARCHITECTURE.md`:

```md
## Admin Console

The OCI management console is embedded in the Fastify backend rather than deployed as a separate application. `/admin` is disabled by default and requires `ADMIN_CONSOLE_ENABLED=true` plus `ADMIN_CONSOLE_TOKEN`. JSON management endpoints live under `/v1/internal/*` and require `INTERNAL_API_TOKEN`.

The console is a diagnostics and controlled-trigger surface. It can inspect health, adapter status, database-backed notification jobs, WebSub subscriptions, live status cache, and redacted delivery attempts. It must not edit user preferences, expose secrets, display production device tokens, create manual push notifications, or bypass preference resolution and notification load reduction.
```

- [ ] **Step 4: Run repository docs scan**

Run:

```bash
rg -n "ADMIN_CONSOLE|/v1/internal/admin|internalBearerAuth" docs shared backend/stellive-hub-api/.env.example
```

Expected: the new environment variables, docs sections, and OpenAPI path entries appear.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add shared/openapi/openapi.yaml docs/API_SETUP.md docs/ARCHITECTURE.md
git commit -m "docs: document OCI admin console"
```

## Task 6: Full Verification And Branch Review

**Files:**
- Verify all files touched in Tasks 1-5.

- [ ] **Step 1: Run backend build**

Run:

```bash
cd backend/stellive-hub-api
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run backend tests**

Run:

```bash
cd backend/stellive-hub-api
npm test
```

Expected: PASS.

- [ ] **Step 3: Verify admin console disabled behavior manually**

Run:

```bash
cd backend/stellive-hub-api
ADMIN_CONSOLE_ENABLED=false npm run build
```

Expected: build still passes. Runtime `/admin` behavior is covered by tests as 404 when disabled.

- [ ] **Step 4: Check policy-sensitive strings**

Run:

```bash
rg -n "manual push|deviceToken|FCM_PRIVATE_KEY|Former|official_youtube_live" backend/stellive-hub-api/src docs shared
```

Expected:

- No manual push action exists in admin routes.
- `deviceToken` is not returned by admin diagnostics.
- `FCM_PRIVATE_KEY` appears only as a readiness key, not as a returned value.
- Former members are not introduced.
- Official YouTube live exclusions remain documented and guarded.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- backend/stellive-hub-api/src/admin backend/stellive-hub-api/src/routes backend/stellive-hub-api/src/repositories backend/stellive-hub-api/src/jobs backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/test docs shared/openapi/openapi.yaml
```

Expected: changes are limited to admin console, internal API, diagnostics repositories, env/docs/contracts, and focused tests.

- [ ] **Step 6: Commit verification follow-up if changes were needed**

Run this only if Step 1-5 required adjustments:

```bash
git add backend/stellive-hub-api docs shared
git commit -m "test: verify OCI admin console"
```

## Self-Review

Spec coverage:

- Embedded Fastify console: Task 4.
- Internal authenticated API: Task 3.
- Redacted environment readiness: Tasks 1 and 2.
- Adapter health: Tasks 2 and 3.
- Notification job diagnostics and bounded drain route: Tasks 2 and 3.
- WebSub diagnostics and renewal trigger: Tasks 2 and 3.
- Live status diagnostics and CHZZK trigger: Tasks 2 and 3.
- Delivery diagnostics without production tokens: Task 2.
- OCI setup docs and API contracts: Task 5.
- Full verification: Task 6.

Policy coverage:

- No Former member catalog changes are planned.
- No manual push creation is planned.
- No secrets or production device tokens are returned.
- X remains disabled by default under `no_paid_api`.
- CHZZK polling returns disabled or verification-required unless explicitly enabled.
- Console-triggered job drain does not bypass the normal worker boundary.

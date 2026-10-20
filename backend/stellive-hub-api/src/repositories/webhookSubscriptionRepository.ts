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

interface WebhookSubscriptionDiagnosticSelect {
  id: true;
  source: true;
  targetId: true;
  topicUrl: true;
  status: true;
  leaseExpiresAt: true;
  lastVerifiedAt: true;
  lastError: true;
}

interface WebhookSubscriptionWriteInput {
  source: string;
  targetId: string;
  callbackUrl: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt?: Date | null;
  lastVerifiedAt?: Date | null;
  lastError?: string | null;
}

export interface WebhookSubscriptionLeaseRecord {
  targetId: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt: Date | null;
  updatedAt: Date;
}

export interface PendingVerificationInput {
  source: string;
  targetId: string;
  callbackUrl: string;
  topicUrl: string;
  /** Time captured before the subscribe request was sent. */
  requestedAt: Date;
}

interface WebhookSubscriptionDelegate {
  webhookSubscription: {
    findMany(args: {
      where: { source: string };
      select: { targetId: true; topicUrl: true; status: true; leaseExpiresAt: true; updatedAt: true };
    }): Promise<WebhookSubscriptionLeaseRecord[]>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: { callbackUrl: string; status: string; lastError: string | null };
    }): Promise<{ count: number }>;
    findUnique(args: {
      where: { source_targetId_topicUrl: { source: string; targetId: string; topicUrl: string } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: { data: WebhookSubscriptionWriteInput }): Promise<unknown>;
    findMany(args: {
      orderBy: { updatedAt: "desc" };
      take: number;
      select: WebhookSubscriptionDiagnosticSelect;
    }): Promise<WebhookSubscriptionRecord[]>;
    upsert(args: {
      where: { source_targetId_topicUrl: { source: string; targetId: string; topicUrl: string } };
      create: WebhookSubscriptionWriteInput;
      update: Omit<WebhookSubscriptionWriteInput, "source" | "targetId" | "topicUrl">;
    }): Promise<unknown>;
    deleteMany?(args: {
      where: { source: string; targetId: string; topicUrl: string };
    }): Promise<{ count: number }>;
  };
  $transaction?<T>(operation: (transaction: WebhookSubscriptionDelegate) => Promise<T>): Promise<T>;
}

const webhookSubscriptionDiagnosticSelect: WebhookSubscriptionDiagnosticSelect = {
  id: true,
  source: true,
  targetId: true,
  topicUrl: true,
  status: true,
  leaseExpiresAt: true,
  lastVerifiedAt: true,
  lastError: true,
};

function clampDiagnosticLimit(limit: number, defaultLimit: number): number {
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
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
    lastError: record.lastError ?? undefined,
  };
}

export class WebhookSubscriptionRepository {
  constructor(
    private readonly prisma: WebhookSubscriptionDelegate = getPrismaClient() as unknown as WebhookSubscriptionDelegate,
  ) {}

  async listDiagnostics(limit = 50): Promise<WebhookSubscriptionDiagnostic[]> {
    const records = await this.prisma.webhookSubscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: clampDiagnosticLimit(limit, 50),
      select: webhookSubscriptionDiagnosticSelect,
    });
    return records.map(toDiagnostic);
  }

  async listLeases(source: string): Promise<WebhookSubscriptionLeaseRecord[]> {
    return this.prisma.webhookSubscription.findMany({
      where: { source },
      select: { targetId: true, topicUrl: true, status: true, leaseExpiresAt: true, updatedAt: true },
    });
  }

  /**
   * Marks a subscription pending after a subscribe request, without downgrading a row the hub already verified
   * during or after that request (verification callbacks often arrive before the subscribe POST returns).
   * Existing leaseExpiresAt/lastVerifiedAt are always preserved.
   */
  async markPendingVerification(input: PendingVerificationInput): Promise<void> {
    const key = { source: input.source, targetId: input.targetId, topicUrl: input.topicUrl };
    const { count } = await this.prisma.webhookSubscription.updateMany({
      where: {
        ...key,
        NOT: { status: "active", lastVerifiedAt: { gte: input.requestedAt } },
      },
      data: { callbackUrl: input.callbackUrl, status: "pending_verification", lastError: null },
    });
    if (count > 0) return;

    const existing = await this.prisma.webhookSubscription.findUnique({
      where: { source_targetId_topicUrl: key },
      select: { id: true },
    });
    if (existing) return; // freshly verified row: keep it as-is

    try {
      await this.prisma.webhookSubscription.create({
        data: { ...key, callbackUrl: input.callbackUrl, status: "pending_verification", lastError: null },
      });
    } catch (error) {
      // A concurrent verification callback created the row first; it is at least as fresh as ours.
      if ((error as { code?: string } | null)?.code !== "P2002") throw error;
    }
  }

  async upsertSubscription(input: WebhookSubscriptionWriteInput): Promise<void> {
    await this.upsertWithDelegate(this.prisma, input);
  }

  async upsertVerifiedSubscription(input: WebhookSubscriptionWriteInput, legacyTargetId?: string): Promise<void> {
    if (!this.prisma.$transaction) {
      if (legacyTargetId && legacyTargetId !== input.targetId) {
        await this.prisma.webhookSubscription.deleteMany?.({
          where: { source: input.source, targetId: legacyTargetId, topicUrl: input.topicUrl },
        });
      }
      await this.upsertWithDelegate(this.prisma, input);
      return;
    }

    await this.prisma.$transaction(async (client) => {
      if (legacyTargetId && legacyTargetId !== input.targetId) {
        await client.webhookSubscription.deleteMany?.({
          where: { source: input.source, targetId: legacyTargetId, topicUrl: input.topicUrl },
        });
      }
      await this.upsertWithDelegate(client, input);
    });
  }

  private async upsertWithDelegate(delegate: WebhookSubscriptionDelegate, input: WebhookSubscriptionWriteInput): Promise<void> {
    await delegate.webhookSubscription.upsert({
      where: {
        source_targetId_topicUrl: {
          source: input.source,
          targetId: input.targetId,
          topicUrl: input.topicUrl,
        },
      },
      create: {
        source: input.source,
        targetId: input.targetId,
        callbackUrl: input.callbackUrl,
        topicUrl: input.topicUrl,
        status: input.status,
        leaseExpiresAt: input.leaseExpiresAt ?? null,
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        lastError: input.lastError ?? null,
      },
      update: {
        callbackUrl: input.callbackUrl,
        status: input.status,
        leaseExpiresAt: input.leaseExpiresAt ?? null,
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        lastError: input.lastError ?? null,
      },
    });
  }
}

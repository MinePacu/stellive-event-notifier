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

interface WebhookSubscriptionDelegate {
  webhookSubscription: {
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

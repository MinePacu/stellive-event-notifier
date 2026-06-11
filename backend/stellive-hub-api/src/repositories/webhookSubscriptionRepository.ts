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

interface WebhookSubscriptionDelegate {
  webhookSubscription: {
    findMany(args: {
      orderBy: { updatedAt: "desc" };
      take: number;
      select: WebhookSubscriptionDiagnosticSelect;
    }): Promise<WebhookSubscriptionRecord[]>;
  };
}

const webhookSubscriptionDiagnosticSelect: WebhookSubscriptionDiagnosticSelect = {
  id: true,
  source: true,
  targetId: true,
  topicUrl: true,
  status: true,
  leaseExpiresAt: true,
  lastVerifiedAt: true,
  lastError: true
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
    lastError: record.lastError ?? undefined
  };
}

export class WebhookSubscriptionRepository {
  constructor(
    private readonly prisma: WebhookSubscriptionDelegate = getPrismaClient() as unknown as WebhookSubscriptionDelegate
  ) {}

  async listDiagnostics(limit = 50): Promise<WebhookSubscriptionDiagnostic[]> {
    const records = await this.prisma.webhookSubscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: clampDiagnosticLimit(limit, 50),
      select: webhookSubscriptionDiagnosticSelect
    });

    return records.map(toDiagnostic);
  }
}

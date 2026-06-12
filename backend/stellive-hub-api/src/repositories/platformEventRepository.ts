import { getPrismaClient } from "../storage/prisma.js";
import type { PlatformEvent } from "../types.js";

interface PlatformEventRecord {
  id: string;
  source: string;
  type: string;
  memberId: string;
  generationId: string;
  title: string;
  body: string;
  platformUrl?: string | null;
  appDeepLink?: string | null;
  occurredAt: Date;
  receivedAt: Date;
  dedupeKey: string;
  realtimeEligible: boolean;
  deliveryMode: string;
  metadata?: unknown;
}

interface PlatformEventDelegate {
  platformEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique?(args: { where: { id: string } }): Promise<PlatformEventRecord | null>;
  };
}

function toDate(value: string): Date {
  return new Date(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function toPlatformEvent(record: PlatformEventRecord): PlatformEvent {
  return {
    id: record.id,
    source: record.source as PlatformEvent["source"],
    type: record.type as PlatformEvent["type"],
    memberId: record.memberId,
    generationId: record.generationId,
    title: record.title,
    body: record.body,
    platformUrl: record.platformUrl ?? "",
    appDeepLink: record.appDeepLink ?? "",
    occurredAt: record.occurredAt.toISOString(),
    receivedAt: record.receivedAt.toISOString(),
    dedupeKey: record.dedupeKey,
    rawPayload: record.metadata,
    realtimeEligible: record.realtimeEligible,
    deliveryMode: record.deliveryMode as PlatformEvent["deliveryMode"]
  };
}

export class PlatformEventRepository {
  constructor(private readonly prisma: PlatformEventDelegate = getPrismaClient() as unknown as PlatformEventDelegate) {}

  async createIfNotExists(event: PlatformEvent): Promise<{ created: boolean }> {
    try {
      await this.prisma.platformEvent.create({
        data: {
          id: event.id,
          source: event.source,
          type: event.type,
          memberId: event.memberId,
          generationId: event.generationId,
          title: event.title,
          body: event.body,
          platformUrl: event.platformUrl,
          appDeepLink: event.appDeepLink,
          occurredAt: toDate(event.occurredAt),
          receivedAt: toDate(event.receivedAt),
          dedupeKey: event.dedupeKey,
          realtimeEligible: event.realtimeEligible,
          deliveryMode: event.deliveryMode,
          metadata: event.rawPayload
        }
      });
      return { created: true };
    } catch (error) {
      if (isUniqueConstraintError(error)) return { created: false };
      throw error;
    }
  }

  async findById(eventId: string): Promise<PlatformEvent | undefined> {
    if (!this.prisma.platformEvent.findUnique) {
      throw new Error("platform_event_lookup_unavailable");
    }
    const record = await this.prisma.platformEvent.findUnique({ where: { id: eventId } });
    return record ? toPlatformEvent(record) : undefined;
  }
}

export default PlatformEventRepository;

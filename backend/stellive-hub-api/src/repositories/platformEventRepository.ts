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
    create?(args: { data: Record<string, unknown> }): Promise<unknown>;
    createMany?(args: { data: Record<string, unknown>; skipDuplicates: boolean }): Promise<{ count: number }>;
    findUnique?(args: { where: { id: string } }): Promise<PlatformEventRecord | null>;
    findFirst?(args: {
      where: { OR: Array<{ id: string } | { dedupeKey: string }> };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

function toDate(value: string): Date {
  return new Date(value);
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

  async createIfNotExists(event: PlatformEvent): Promise<{ created: boolean; eventId: string }> {
    const data = {
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
    };
    if (!this.prisma.platformEvent.createMany) throw new Error("platform_event_create_many_unavailable");
    const result = await this.prisma.platformEvent.createMany({ data, skipDuplicates: true });
    if (result.count === 1) return { created: true, eventId: event.id };

    if (!this.prisma.platformEvent.findFirst) throw new Error("platform_event_duplicate_lookup_unavailable");
    const existing = await this.prisma.platformEvent.findFirst({
      where: { OR: [{ id: event.id }, { dedupeKey: event.dedupeKey }] },
      select: { id: true }
    });
    if (!existing) throw new Error("platform_event_duplicate_missing");
    return { created: false, eventId: existing.id };
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

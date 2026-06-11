import { getPrismaClient } from "../storage/prisma.js";
import type { PlatformEvent } from "../types.js";

interface PlatformEventDelegate {
  platformEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

function toDate(value: string): Date {
  return new Date(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
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
}

export default PlatformEventRepository;

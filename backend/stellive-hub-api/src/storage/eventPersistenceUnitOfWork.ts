import type { Prisma } from "@prisma/client";
import NotificationJobRepository from "../jobs/notificationJobRepository.js";
import { LiveStatusRepository } from "../repositories/liveStatusRepository.js";
import PlatformEventRepository from "../repositories/platformEventRepository.js";
import { getPrismaClient } from "./prisma.js";

export interface EventPersistenceScope {
  liveStatuses: LiveStatusRepository;
  platformEvents: PlatformEventRepository;
  notificationJobs: NotificationJobRepository;
}

export interface EventPersistenceUnitOfWork {
  runInTransaction<T>(operation: (scope: EventPersistenceScope) => Promise<T>): Promise<T>;
}

interface PrismaTransactionRunner {
  $transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
    options: { isolationLevel: "Serializable" }
  ): Promise<T>;
}

function isRetryableTransactionConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

export class PrismaEventPersistenceUnitOfWork implements EventPersistenceUnitOfWork {
  constructor(
    private readonly prisma: PrismaTransactionRunner = getPrismaClient() as unknown as PrismaTransactionRunner
  ) {}

  async runInTransaction<T>(operation: (scope: EventPersistenceScope) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (client) => operation({
          liveStatuses: new LiveStatusRepository(client as never),
          platformEvents: new PlatformEventRepository(client as never),
          notificationJobs: new NotificationJobRepository(client as never)
        }), { isolationLevel: "Serializable" });
      } catch (error) {
        if (attempt === 0 && isRetryableTransactionConflict(error)) continue;
        throw error;
      }
    }

    throw new Error("event_persistence_transaction_retry_exhausted");
  }
}

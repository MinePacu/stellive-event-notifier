import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../storage/prisma.js";

interface PlatformApiStateDelegate {
  platformApiState: {
    upsert(args: {
      where: { source_key: { source: string; key: string } };
      create: { source: string; key: string; value: Prisma.InputJsonValue; status: string };
      update: { value: Prisma.InputJsonValue; status: string };
    }): Promise<unknown>;
  };
}

export interface PlatformApiStateInput {
  source: string;
  key: string;
  value: Prisma.InputJsonValue;
  status: string;
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
}

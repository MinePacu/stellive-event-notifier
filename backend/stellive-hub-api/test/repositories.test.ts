import { describe, expect, it } from "vitest";
import { NotificationJobRepository } from "../src/jobs/notificationJobRepository.js";
import { PlatformApiStateRepository } from "../src/repositories/platformApiStateRepository.js";

describe("PlatformApiStateRepository", () => {
  it("upserts API state by source and key", async () => {
    const calls: unknown[] = [];
    const prisma = {
      platformApiState: {
        upsert: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    };

    const repository = new PlatformApiStateRepository(prisma);

    await repository.upsert({
      source: "x",
      key: "integration",
      value: { costPolicy: "no_paid_api" },
      status: "disabled"
    });

    expect(calls).toEqual([
      {
        where: { source_key: { source: "x", key: "integration" } },
        create: {
          source: "x",
          key: "integration",
          value: { costPolicy: "no_paid_api" },
          status: "disabled"
        },
        update: {
          value: { costPolicy: "no_paid_api" },
          status: "disabled"
        }
      }
    ]);
  });
});

describe("NotificationJobRepository", () => {
  it("enqueues notification jobs with queued status", async () => {
    const calls: unknown[] = [];
    const prisma = {
      notificationJob: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    };

    const repository = new NotificationJobRepository(prisma);

    await repository.enqueue({ eventId: "event-1", priority: 3 });

    expect(calls).toEqual([
      {
        data: {
          eventId: "event-1",
          priority: 3,
          status: "queued"
        }
      }
    ]);
  });
});

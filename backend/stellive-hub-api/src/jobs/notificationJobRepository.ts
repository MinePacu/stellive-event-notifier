import { getPrismaClient } from "../storage/prisma.js";

interface NotificationJobDelegate {
  notificationJob: {
    create(args: { data: { eventId: string; priority: number; status: string } }): Promise<unknown>;
  };
}

export interface EnqueueNotificationJobInput {
  eventId: string;
  priority: number;
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
}

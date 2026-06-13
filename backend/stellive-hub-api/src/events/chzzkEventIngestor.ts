import NotificationJobRepository from "../jobs/notificationJobRepository.js";
import PlatformEventRepository from "../repositories/platformEventRepository.js";
import type { PlatformEvent } from "../types.js";

export default class ChzzkEventIngestor {
  constructor(
    private readonly events = new PlatformEventRepository(),
    private readonly jobs = new NotificationJobRepository()
  ) {}

  async ingest(event: PlatformEvent): Promise<{ created: boolean }> {
    const result = await this.events.createIfNotExists(event);
    if (!result.created) return { created: false };

    await this.jobs.enqueue({
      eventId: event.id,
      priority: event.realtimeEligible ? 1 : 5
    });

    return { created: true };
  }
}

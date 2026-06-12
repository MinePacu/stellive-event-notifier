import type { CatalogService } from "../catalog/catalog.js";
import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { PlatformEventRepository } from "../repositories/platformEventRepository.js";
import type { PlatformEvent } from "../types.js";
import type { HubEvent } from "../types.js";
import { buildHubEventNotificationCandidates } from "./hubEventNotificationFactory.js";
import type {
  AdminHubEvent,
  HubEventAdminAction,
  HubEventAdminValidationResult,
  HubEventValidationError,
  HubEventPublicationState
} from "./hubEventAdminTypes.js";
import {
  HubEventRepository,
  type AdminHubEventFilters,
  type AdminHubEventListResult,
  type AdminHubEventWriteInput,
  type HubEventAuditLogEntry,
  type HubEventAuditLogInput
} from "./hubEventRepository.js";
import { validateHubEventForAdmin } from "./hubEventPolicy.js";

export interface HubEventAdminActor {
  actorId?: string;
  reason?: string;
}

interface HubEventAdminRepository {
  createDraft(input: AdminHubEventWriteInput): Promise<AdminHubEvent>;
  update(id: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent>;
  setPublicationState(input: {
    id: string;
    publicationState: HubEventPublicationState;
    actorId?: string;
    publishedAt?: Date;
    cancelledAt?: Date;
    deactivatedAt?: Date;
  }): Promise<AdminHubEvent>;
  softDelete(input: { id: string; actorId?: string; deletedAt: Date }): Promise<AdminHubEvent>;
  getAdminById(id: string): Promise<AdminHubEvent | undefined>;
  listAdmin(filters: AdminHubEventFilters): Promise<AdminHubEventListResult>;
  listAuditLog(hubEventId: string, limit: number): Promise<HubEventAuditLogEntry[]>;
  writeAuditLog(input: HubEventAuditLogInput): Promise<void>;
}

interface HubEventPlatformEventRepository {
  createIfNotExists(event: PlatformEvent): Promise<{ created: boolean }>;
}

interface HubEventNotificationJobRepository {
  enqueue(input: { eventId: string; priority: number }): Promise<unknown>;
}

export interface HubEventAdminServiceOptions {
  catalog: CatalogService;
  repository?: HubEventAdminRepository;
  platformEvents?: HubEventPlatformEventRepository;
  notificationJobs?: HubEventNotificationJobRepository;
  now?: () => Date;
}

export class HubEventAdminValidationException extends Error {
  readonly statusCode = 400;

  constructor(readonly errors: HubEventValidationError[]) {
    super("hub_event_validation_failed");
  }
}

export class HubEventAdminService {
  private readonly repository: HubEventAdminRepository;
  private readonly platformEvents: HubEventPlatformEventRepository;
  private readonly notificationJobs: HubEventNotificationJobRepository;
  private readonly now: () => Date;

  constructor(private readonly options: HubEventAdminServiceOptions) {
    this.repository = options.repository ?? new HubEventRepository();
    this.platformEvents = options.platformEvents ?? new PlatformEventRepository();
    this.notificationJobs = options.notificationJobs ?? new NotificationJobRepository();
    this.now = options.now ?? (() => new Date());
  }

  validate(input: unknown, mode: "draft" | "publish"): HubEventAdminValidationResult {
    return validateHubEventForAdmin(input, this.options.catalog, mode);
  }

  async createDraft(input: AdminHubEventWriteInput, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    this.assertValid(input, "draft");
    const created = await this.repository.createDraft({ ...input, actorId: actor.actorId });
    await this.audit("create", created.id, actor, null, created);
    return created;
  }

  async update(id: string, input: AdminHubEventWriteInput, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    this.assertValid({ ...before, ...input }, before.publicationState === "published" ? "publish" : "draft");
    const updated = await this.repository.update(id, { ...input, actorId: actor.actorId });
    await this.audit("update", id, actor, before, updated);
    await this.enqueueNotificationCandidates("update", before, updated);
    return updated;
  }

  async publish(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    this.assertValid(before, "publish");
    const published = await this.repository.setPublicationState({
      id,
      publicationState: "published",
      actorId: actor.actorId,
      publishedAt: this.now()
    });
    await this.audit("publish", id, actor, before, published);
    await this.enqueueNotificationCandidates("publish", before, published);
    return published;
  }

  async cancel(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    const cancelledAt = this.now();
    const statusUpdated = await this.repository.update(id, {
      status: "cancelled",
      actorId: actor.actorId
    });
    const cancelled = await this.repository.setPublicationState({
      id,
      publicationState: "published",
      actorId: actor.actorId,
      cancelledAt
    });
    const after: AdminHubEvent = {
      ...statusUpdated,
      ...cancelled,
      status: "cancelled",
      cancelledAt: cancelledAt.toISOString()
    };
    await this.audit("cancel", id, actor, before, after);
    await this.enqueueNotificationCandidates("cancel", before, after);
    return after;
  }

  async deactivate(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    const deactivated = await this.repository.setPublicationState({
      id,
      publicationState: "inactive",
      actorId: actor.actorId,
      deactivatedAt: this.now()
    });
    await this.audit("deactivate", id, actor, before, deactivated);
    return deactivated;
  }

  async delete(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    const deleted = await this.repository.softDelete({
      id,
      actorId: actor.actorId,
      deletedAt: this.now()
    });
    await this.audit("delete", id, actor, before, deleted);
    return deleted;
  }

  async list(filters: AdminHubEventFilters = {}): Promise<AdminHubEventListResult> {
    return this.repository.listAdmin(filters);
  }

  async getById(id: string): Promise<AdminHubEvent | undefined> {
    return this.repository.getAdminById(id);
  }

  async listAuditLog(id: string, limit = 25): Promise<HubEventAuditLogEntry[]> {
    return this.repository.listAuditLog(id, limit);
  }

  private assertValid(input: unknown, mode: "draft" | "publish") {
    const result = this.validate(input, mode);
    if (!result.valid) {
      throw new HubEventAdminValidationException(result.errors);
    }
  }

  private async getExisting(id: string): Promise<AdminHubEvent> {
    const event = await this.repository.getAdminById(id);
    if (!event) throw new Error("hub_event_not_found");
    return event;
  }

  private assertMutable(event: AdminHubEvent) {
    if (event.publicationState === "deleted" || event.deletedAt) {
      throw new Error("hub_event_deleted");
    }
  }

  private async enqueueNotificationCandidates(
    action: HubEventAdminAction,
    before: AdminHubEvent | undefined,
    after: AdminHubEvent
  ): Promise<void> {
    const candidates = buildHubEventNotificationCandidates({ before, after, action, now: this.now() });
    for (const candidate of candidates) {
      const result = await this.platformEvents.createIfNotExists(candidate);
      if (result.created) {
        await this.notificationJobs.enqueue({ eventId: candidate.id, priority: 5 });
      }
    }
  }

  private async audit(
    action: HubEventAdminAction,
    hubEventId: string,
    actor: HubEventAdminActor,
    before: HubEvent | AdminHubEvent | null,
    after: HubEvent | AdminHubEvent
  ) {
    await this.repository.writeAuditLog({
      hubEventId,
      action,
      actorId: actor.actorId,
      reason: actor.reason,
      before,
      after
    });
  }
}

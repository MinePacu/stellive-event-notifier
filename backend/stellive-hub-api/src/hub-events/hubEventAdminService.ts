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
  type AdminHubEventScheduleItemWriteInput,
  type AdminHubEventWriteInput,
  type HubEventAuditLogEntry,
  type HubEventAuditLogInput
} from "./hubEventRepository.js";
import { validateHubEventForAdmin } from "./hubEventPolicy.js";
import { normalizeHubEventLinks } from "./hubEventLinkPolicy.js";
import { normalizeHubEventTags } from "./hubEventTagPolicy.js";
import { PrismaHubEventAdminUnitOfWork } from "./hubEventAdminUnitOfWork.js";
import {
  deriveHubEventScheduleMode,
  normalizeHubEventScheduleText,
  withDefaultPrimaryScheduleItem,
  withPrimaryScheduleItem
} from "./hubEventSchedulePolicy.js";

export interface HubEventAdminActor {
  actorId?: string;
  reason?: string;
}

export interface HubEventAdminRepository {
  createDraft(input: AdminHubEventWriteInput): Promise<AdminHubEvent>;
  update(id: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent>;
  hardDeleteScheduleItem?(id: string, scheduleItemId: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent>;
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

export interface HubEventPlatformEventRepository {
  createIfNotExists(event: PlatformEvent): Promise<{ created: boolean; eventId?: string }>;
}

export interface HubEventNotificationJobRepository {
  enqueue(input: { eventId: string; priority: number; runAfter?: Date }): Promise<unknown>;
}

export interface HubEventAdminTransactionRepositories {
  hubEvents: HubEventAdminRepository;
  platformEvents: HubEventPlatformEventRepository;
  notificationJobs: HubEventNotificationJobRepository;
}

export interface HubEventAdminUnitOfWork {
  run<T>(work: (repositories: HubEventAdminTransactionRepositories) => Promise<T>): Promise<T>;
}

export interface HubEventAdminServiceOptions {
  catalog: CatalogService;
  repository?: HubEventAdminRepository;
  platformEvents?: HubEventPlatformEventRepository;
  notificationJobs?: HubEventNotificationJobRepository;
  unitOfWork?: HubEventAdminUnitOfWork;
  now?: () => Date;
}

export class HubEventAdminValidationException extends Error {
  readonly statusCode = 400;

  constructor(readonly errors: HubEventValidationError[]) {
    super("hub_event_validation_failed");
  }
}

export class HubEventRevisionConflictException extends Error {
  readonly statusCode = 409;

  constructor(readonly expectedRevision: number, readonly currentRevision: number) {
    super("hub_event_revision_conflict");
  }
}

export interface HubEventScheduleMutationInput extends AdminHubEventScheduleItemWriteInput {
  expectedRevision: number;
}

export interface HubEventScheduleOrderInput {
  expectedRevision: number;
  scheduleItemIds: string[];
}

export interface HubEventScheduleDeleteResult {
  event: AdminHubEvent;
  scheduleItemId: string;
  deletion: "cancelled" | "hard_deleted";
}

export class HubEventAdminService {
  private readonly repository: HubEventAdminRepository;
  private readonly platformEvents: HubEventPlatformEventRepository;
  private readonly notificationJobs: HubEventNotificationJobRepository;
  private readonly unitOfWork: HubEventAdminUnitOfWork;
  private readonly now: () => Date;

  constructor(private readonly options: HubEventAdminServiceOptions) {
    this.repository = options.repository ?? new HubEventRepository();
    this.platformEvents = options.platformEvents ?? new PlatformEventRepository();
    this.notificationJobs = options.notificationJobs ?? new NotificationJobRepository();
    this.unitOfWork = options.unitOfWork ?? (
      options.repository || options.platformEvents || options.notificationJobs
        ? {
            run: async <T>(work: (repositories: HubEventAdminTransactionRepositories) => Promise<T>) => work({
              hubEvents: this.repository,
              platformEvents: this.platformEvents,
              notificationJobs: this.notificationJobs
            })
          }
        : new PrismaHubEventAdminUnitOfWork()
    );
    this.now = options.now ?? (() => new Date());
  }

  validate(input: unknown, mode: "draft" | "publish"): HubEventAdminValidationResult {
    return validateHubEventForAdmin(input, this.options.catalog, mode);
  }

  async createDraft(input: AdminHubEventWriteInput, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const singleWindowNormalized = this.normalizeSingleWindowWrite(this.normalizeLinkWrite(this.normalizeTagWrite(input)));
    const normalized = this.normalizeScheduleWrite({
      ...singleWindowNormalized,
      scheduleItems: singleWindowNormalized.scheduleItems ?? []
    });
    this.assertValid(normalized, "draft");
    return this.unitOfWork.run(async ({ hubEvents }) => {
      const created = await hubEvents.createDraft({ ...normalized, actorId: actor.actorId });
      await this.audit(hubEvents, "create", created.id, actor, null, created);
      return created;
    });
  }

  async update(id: string, input: AdminHubEventWriteInput, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    const normalized = this.withExistingScheduleProjection(
      this.normalizeScheduleWrite(this.normalizeSingleWindowWrite(this.normalizeLinkWrite(this.normalizeTagWrite(input)), before)),
      before
    );
    this.assertValid({ ...before, ...normalized }, before.publicationState === "published" ? "publish" : "draft");
    return this.unitOfWork.run(async (repositories) => {
      const updated = await repositories.hubEvents.update(id, { ...normalized, actorId: actor.actorId });
      await this.audit(repositories.hubEvents, "update", id, actor, before, updated);
      await this.enqueueNotificationCandidates(repositories, "update", before, updated);
      return updated;
    });
  }

  async publish(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    this.assertValid(before, "publish");
    return this.unitOfWork.run(async (repositories) => {
      const published = await repositories.hubEvents.setPublicationState({
        id,
        publicationState: "published",
        actorId: actor.actorId,
        publishedAt: this.now()
      });
      await this.audit(repositories.hubEvents, "publish", id, actor, before, published);
      await this.enqueueNotificationCandidates(repositories, "publish", before, published);
      return published;
    });
  }

  async cancel(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    const cancelledAt = this.now();
    return this.unitOfWork.run(async (repositories) => {
      const statusUpdated = await repositories.hubEvents.update(id, {
        status: "cancelled",
        actorId: actor.actorId
      });
      const cancelled = await repositories.hubEvents.setPublicationState({
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
      await this.audit(repositories.hubEvents, "cancel", id, actor, before, after);
      await this.enqueueNotificationCandidates(repositories, "cancel", before, after);
      return after;
    });
  }

  async deactivate(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    return this.unitOfWork.run(async ({ hubEvents }) => {
      const deactivated = await hubEvents.setPublicationState({
        id,
        publicationState: "inactive",
        actorId: actor.actorId,
        deactivatedAt: this.now()
      });
      await this.audit(hubEvents, "deactivate", id, actor, before, deactivated);
      return deactivated;
    });
  }

  async delete(id: string, actor: HubEventAdminActor = {}): Promise<AdminHubEvent> {
    const before = await this.getExisting(id);
    this.assertMutable(before);
    return this.unitOfWork.run(async ({ hubEvents }) => {
      const deleted = await hubEvents.softDelete({
        id,
        actorId: actor.actorId,
        deletedAt: this.now()
      });
      await this.audit(hubEvents, "delete", id, actor, before, deleted);
      return deleted;
    });
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

  async createScheduleItem(
    id: string,
    input: HubEventScheduleMutationInput,
    actor: HubEventAdminActor = {}
  ): Promise<AdminHubEvent> {
    const before = await this.getScheduleMutableEvent(id, input.expectedRevision);
    this.assertScheduleMutationTitle(input);
    const { expectedRevision, id: _ignoredScheduleItemId, ...rawScheduleInput } = input;
    const scheduleInput = { ...rawScheduleInput, links: normalizeHubEventLinks(rawScheduleInput.links) };
    const items = [...this.scheduleWriteItems(before), {
      ...scheduleInput,
      sortOrder: scheduleInput.sortOrder ?? before.scheduleItems?.length ?? 0,
      cancelledAt: null
    }];
    const normalizedItems = scheduleInput.isPrimary === true
      ? withPrimaryScheduleItem(items, items.length - 1)
      : items;
    return this.persistScheduleMutation(before, normalizedItems, expectedRevision, "schedule_create", actor);
  }

  async updateScheduleItem(
    id: string,
    scheduleItemId: string,
    input: HubEventScheduleMutationInput,
    actor: HubEventAdminActor = {}
  ): Promise<AdminHubEvent> {
    const before = await this.getScheduleMutableEvent(id, input.expectedRevision);
    const existing = this.requireOwnedScheduleItem(before, scheduleItemId);
    const { expectedRevision, ...rawPatch } = input;
    const patch = { ...rawPatch, links: normalizeHubEventLinks(rawPatch.links) };
    if (patch.isPrimary === true && existing.cancelledAt) {
      throw new HubEventAdminValidationException([{
        field: "isPrimary",
        reason: "schedule_item_invalid",
        message: "A cancelled schedule item cannot be primary."
      }]);
    }
    const items = this.scheduleWriteItems(before).map((item) =>
      item.id === scheduleItemId ? { ...existing, ...patch, id: scheduleItemId } : item
    );
    const targetIndex = items.findIndex((item) => item.id === scheduleItemId);
    const normalizedItems = patch.isPrimary === true ? withPrimaryScheduleItem(items, targetIndex) : items;
    return this.persistScheduleMutation(before, normalizedItems, expectedRevision, "schedule_update", actor);
  }

  async deleteScheduleItem(
    id: string,
    scheduleItemId: string,
    expectedRevision: number,
    actor: HubEventAdminActor = {}
  ): Promise<HubEventScheduleDeleteResult> {
    const before = await this.getScheduleMutableEvent(id, expectedRevision);
    const existing = this.requireOwnedScheduleItem(before, scheduleItemId);
    this.assertPrimaryCanBeCancelled(before, existing);
    const hardDelete = before.publicationState === "draft";
    if (hardDelete) {
      const items = this.scheduleWriteItems(before).filter((item) => item.id !== scheduleItemId);
      const normalized = withDefaultPrimaryScheduleItem(items);
      const scheduleMode = deriveHubEventScheduleMode(normalized);
      this.assertValid(
        { ...before, scheduleMode, scheduleItems: normalized },
        before.publicationState === "published" ? "publish" : "draft"
      );
      return this.unitOfWork.run(async (repositories) => {
        const hardDeleteScheduleItem = repositories.hubEvents.hardDeleteScheduleItem?.bind(repositories.hubEvents);
        if (!hardDeleteScheduleItem) throw new Error("hub_event_schedule_item_delete_unavailable");
        const event = await this.runRevisionWrite(repositories.hubEvents, before, expectedRevision, () =>
          hardDeleteScheduleItem(id, scheduleItemId, {
            scheduleMode,
            scheduleItems: normalized,
            expectedRevision,
            actorId: actor.actorId
          })
        );
        await this.audit(repositories.hubEvents, "schedule_delete", id, actor, before, event);
        await this.enqueueNotificationCandidates(repositories, "schedule_delete", before, event);
        return { event, scheduleItemId, deletion: "hard_deleted" };
      });
    }

    const cancelledAt = this.now().toISOString();
    const items = this.scheduleWriteItems(before).map((item) =>
      item.id === scheduleItemId ? { ...item, cancelledAt, isPrimary: false } : item
    );
    const event = await this.persistScheduleMutation(before, items, expectedRevision, "schedule_cancel", actor);
    return { event, scheduleItemId, deletion: "cancelled" };
  }

  async restoreScheduleItem(
    id: string,
    scheduleItemId: string,
    expectedRevision: number,
    actor: HubEventAdminActor = {}
  ): Promise<AdminHubEvent> {
    const before = await this.getScheduleMutableEvent(id, expectedRevision);
    const existing = this.requireOwnedScheduleItem(before, scheduleItemId);
    if (!existing.cancelledAt) return before;
    const items = this.scheduleWriteItems(before).map((item) =>
      item.id === scheduleItemId ? { ...item, cancelledAt: null, isPrimary: false } : item
    );
    return this.persistScheduleMutation(before, items, expectedRevision, "schedule_restore", actor);
  }

  async reorderScheduleItems(
    id: string,
    input: HubEventScheduleOrderInput,
    actor: HubEventAdminActor = {}
  ): Promise<AdminHubEvent> {
    const before = await this.getScheduleMutableEvent(id, input.expectedRevision);
    const current = this.scheduleWriteItems(before);
    const currentIds = new Set(current.map((item) => item.id).filter(Boolean));
    if (input.scheduleItemIds.length !== current.length ||
        new Set(input.scheduleItemIds).size !== current.length ||
        input.scheduleItemIds.some((itemId) => !currentIds.has(itemId))) {
      throw new HubEventAdminValidationException([{
        field: "scheduleItemIds",
        reason: "schedule_item_invalid",
        message: "scheduleItemIds must contain every schedule item exactly once."
      }]);
    }
    const order = new Map(input.scheduleItemIds.map((itemId, index) => [itemId, index]));
    const items = current.map((item) => ({ ...item, sortOrder: order.get(item.id ?? "") ?? item.sortOrder ?? 0 }));
    return this.persistScheduleMutation(before, items, input.expectedRevision, "schedule_reorder", actor);
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

  private normalizeScheduleWrite(input: AdminHubEventWriteInput): AdminHubEventWriteInput {
    if (input.scheduleItems === undefined) return input;
    const scheduleItems = withDefaultPrimaryScheduleItem(
      input.scheduleItems.map((item) => ({
        ...item,
        ...normalizeHubEventScheduleText(item),
        links: normalizeHubEventLinks(item.links)
      }))
    );
    return { ...input, scheduleItems, scheduleMode: deriveHubEventScheduleMode(scheduleItems) };
  }

  private normalizeLinkWrite(input: AdminHubEventWriteInput): AdminHubEventWriteInput {
    return { ...input, links: normalizeHubEventLinks(input.links) };
  }

  private normalizeTagWrite(input: AdminHubEventWriteInput): AdminHubEventWriteInput {
    if (input.tags === undefined) return input;
    return { ...input, tags: normalizeHubEventTags(input.tags) as AdminHubEventWriteInput["tags"] };
  }

  private assertScheduleMutationTitle(input: AdminHubEventScheduleItemWriteInput) {
    if (input.title?.trim()) return;
    throw new HubEventAdminValidationException([{
      field: "title",
      reason: "schedule_item_required",
      message: "Schedule item title is required."
    }]);
  }

  private withExistingScheduleProjection(
    input: AdminHubEventWriteInput,
    existing: AdminHubEvent
  ): AdminHubEventWriteInput {
    if (input.scheduleItems !== undefined) return input;
    if ((existing.scheduleItems ?? []).length === 0) return { ...input, scheduleMode: "single_window" };
    const scheduleItems = this.scheduleWriteItems(existing);
    return {
      ...input,
      scheduleItems,
      scheduleMode: deriveHubEventScheduleMode(scheduleItems)
    };
  }

  private scheduleWriteItems(event: AdminHubEvent): AdminHubEventScheduleItemWriteInput[] {
    return (event.scheduleItems ?? []).map((item) => ({ ...item }));
  }

  private async getScheduleMutableEvent(id: string, expectedRevision: number): Promise<AdminHubEvent> {
    const event = await this.getExisting(id);
    this.assertMutable(event);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1 || event.revision !== expectedRevision) {
      throw new HubEventRevisionConflictException(expectedRevision, event.revision);
    }
    return event;
  }

  private requireOwnedScheduleItem(before: AdminHubEvent, scheduleItemId: string) {
    const item = before.scheduleItems?.find((candidate) => candidate.id === scheduleItemId);
    if (!item) throw new Error("hub_event_schedule_item_not_found");
    return item;
  }

  private assertPrimaryCanBeCancelled(before: AdminHubEvent, item: NonNullable<AdminHubEvent["scheduleItems"]>[number]) {
    if (!item.cancelledAt && item.isPrimary && (
      before.publicationState === "published" ||
      (before.scheduleItems ?? []).some((candidate) => candidate.id !== item.id && !candidate.cancelledAt)
    )) {
      throw new HubEventAdminValidationException([{
        field: "scheduleItems",
        reason: "schedule_primary_required",
        message: "Choose a replacement primary schedule before cancelling the current primary schedule."
      }]);
    }
  }

  private async persistScheduleMutation(
    before: AdminHubEvent,
    items: AdminHubEventScheduleItemWriteInput[],
    expectedRevision: number,
    action: Extract<HubEventAdminAction, `schedule_${string}`>,
    actor: HubEventAdminActor
  ): Promise<AdminHubEvent> {
    const scheduleItems = withDefaultPrimaryScheduleItem(
      items.map((item) => ({ ...item, ...normalizeHubEventScheduleText(item) }))
    );
    const scheduleMode = deriveHubEventScheduleMode(scheduleItems);
    this.assertValid(
      { ...before, scheduleMode, scheduleItems },
      before.publicationState === "published" ? "publish" : "draft"
    );
    return this.unitOfWork.run(async (repositories) => {
      const updated = await this.runRevisionWrite(repositories.hubEvents, before, expectedRevision, () =>
        repositories.hubEvents.update(before.id, {
          scheduleMode,
          scheduleItems,
          expectedRevision,
          actorId: actor.actorId
        })
      );
      await this.audit(repositories.hubEvents, action, before.id, actor, before, updated);
      await this.enqueueNotificationCandidates(repositories, action, before, updated);
      return updated;
    });
  }

  private async runRevisionWrite(
    repository: HubEventAdminRepository,
    before: AdminHubEvent,
    expectedRevision: number,
    write: () => Promise<AdminHubEvent>
  ): Promise<AdminHubEvent> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Error && error.message === "hub_event_revision_conflict") {
        const current = await repository.getAdminById(before.id);
        throw new HubEventRevisionConflictException(expectedRevision, current?.revision ?? before.revision);
      }
      throw error;
    }
  }

  private normalizeSingleWindowWrite(
    input: AdminHubEventWriteInput,
    existing?: AdminHubEvent
  ): AdminHubEventWriteInput {
    if (input.scheduleItems !== undefined) return input;
    const scheduleMode = input.scheduleMode ?? existing?.scheduleMode ?? "single_window";
    if (scheduleMode !== "single_window") return input;

    const datesChanged = input.startsAt !== undefined || input.endsAt !== undefined;
    if (existing && !datesChanged) return input;
    const startsAt = input.startsAt !== undefined ? input.startsAt : existing?.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : existing?.endsAt;
    if (!startsAt && !endsAt) return { ...input, scheduleMode };

    const previous = existing?.scheduleItems?.find((item) => item.isPrimary && !item.cancelledAt) ??
      existing?.scheduleItems?.find((item) => !item.cancelledAt);
    return {
      ...input,
      scheduleMode,
      scheduleItems: [{
        ...previous,
        id: previous?.id,
        kind: "main_window",
        title: previous?.title ?? previous?.label ?? input.title ?? existing?.title ?? "행사 일정",
        label: previous?.label ?? input.title ?? existing?.title ?? "행사 일정",
        startsAt: startsAt ?? endsAt,
        endsAt: startsAt ? endsAt : null,
        timePrecision: previous?.timePrecision ?? "datetime",
        timezone: previous?.timezone ?? "Asia/Seoul",
        notificationEligible: previous?.notificationEligible ?? input.notificationEligible ?? existing?.notificationEligible ?? true,
        isPrimary: true,
        sortOrder: previous?.sortOrder ?? 0,
        cancelledAt: null
      }]
    };
  }

  private async enqueueNotificationCandidates(
    repositories: Pick<HubEventAdminTransactionRepositories, "platformEvents" | "notificationJobs">,
    action: HubEventAdminAction,
    before: AdminHubEvent | undefined,
    after: AdminHubEvent
  ): Promise<void> {
    const candidates = buildHubEventNotificationCandidates({ before, after, action, now: this.now() });
    for (const candidate of candidates) {
      await this.ensureEventAndJob(repositories, candidate);
    }
  }

  private async ensureEventAndJob(
    repositories: Pick<HubEventAdminTransactionRepositories, "platformEvents" | "notificationJobs">,
    candidate: PlatformEvent
  ): Promise<void> {
    const event = await repositories.platformEvents.createIfNotExists(candidate);
    const metadata = candidate.rawPayload;
    const isScheduleCandidate = typeof metadata === "object" && metadata !== null && "scheduleItemId" in metadata;
    await repositories.notificationJobs.enqueue({
      eventId: event.eventId ?? candidate.id,
      priority: candidate.realtimeEligible ? 1 : 5,
      ...(isScheduleCandidate ? { runAfter: new Date(candidate.occurredAt) } : {})
    });
  }

  private async audit(
    repository: HubEventAdminRepository,
    action: HubEventAdminAction,
    hubEventId: string,
    actor: HubEventAdminActor,
    before: HubEvent | AdminHubEvent | null,
    after: HubEvent | AdminHubEvent
  ) {
    await repository.writeAuditLog({
      hubEventId,
      action,
      actorId: actor.actorId,
      reason: actor.reason,
      before,
      after
    });
  }
}

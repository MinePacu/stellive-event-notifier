import { z } from "zod";
import { buildServiceAnnouncementEvent } from "./serviceAnnouncementEvent.js";
import {
  PrismaServiceAnnouncementDispatchUnitOfWork,
  type ServiceAnnouncementDispatchRepositories,
  type ServiceAnnouncementDispatchUnitOfWork,
} from "./serviceAnnouncementDispatchUnitOfWork.js";
import {
  ServiceAnnouncementRepository,
  compareAppVersions,
  type AdminServiceAnnouncement,
  type ServiceAnnouncementWriteInput,
} from "./serviceAnnouncementRepository.js";
import { isValidAppVersion } from "./serviceAnnouncementTargetPolicy.js";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional();
const writeSchema = z.object({
  type: z.enum(["general", "incident", "maintenance", "version_update"]),
  severity: z.enum(["info", "important", "critical"]),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  isPinned: z.boolean().default(false),
  targetPlatforms: z.array(z.enum(["android", "ios"])).min(1),
  minimumAppVersion: z.string().trim().max(40).nullable().optional(),
  maximumAppVersion: z.string().trim().max(40).nullable().optional(),
  appDeepLink: z.union([z.string().regex(/^stellivehub:\/\//), z.literal(""), z.null()]).optional(),
  externalUrl: optionalUrl,
  actionLabel: z.string().trim().max(40).nullable().optional(),
  expiresAt: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
  pushEnabled: z.boolean().default(true),
});
const draftSchema = writeSchema.partial().extend({
  title: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(300).optional(),
  body: z.string().trim().max(20_000).optional(),
  targetPlatforms: z.array(z.enum(["android", "ios"])).optional(),
});

export class ServiceAnnouncementValidationError extends Error {
  readonly statusCode = 400;
  constructor(readonly errors: Array<{ path: string; message: string }>) {
    super("service_announcement_validation_failed");
  }
}

export interface ServiceAnnouncementAdminActor {
  actorId?: string;
  reason?: string;
  sendPush?: boolean;
}

export class ServiceAnnouncementAdminService {
  constructor(private readonly options: {
    repository?: ServiceAnnouncementRepository;
    /** @deprecated Legacy topic sender is ignored; dispatch always uses persisted jobs. */
    sender?: unknown;
    invalidateCache: () => void;
    now?: () => Date;
    dispatchUnitOfWork?: ServiceAnnouncementDispatchUnitOfWork;
  }) {}

  private get repository() { return this.options.repository ??= new ServiceAnnouncementRepository(); }
  private get now() { return this.options.now ?? (() => new Date()); }
  private get dispatchUnitOfWork() { return this.options.dispatchUnitOfWork ?? new PrismaServiceAnnouncementDispatchUnitOfWork(); }

  validate(input: unknown, mode: "draft" | "publish" = "publish"): ServiceAnnouncementWriteInput {
    if (mode === "draft") {
      const draft = draftSchema.safeParse(input);
      if (!draft.success) this.throwValidation(draft.error);
      return draft.data as ServiceAnnouncementWriteInput;
    }
    const result = writeSchema.safeParse(input);
    if (!result.success) this.throwValidation(result.error);
    const value = result.data;
    if (value.minimumAppVersion && !isValidAppVersion(value.minimumAppVersion)) {
      throw new ServiceAnnouncementValidationError([{ path: "minimumAppVersion", message: "최소 앱 버전 형식이 올바르지 않습니다." }]);
    }
    if (value.maximumAppVersion && !isValidAppVersion(value.maximumAppVersion)) {
      throw new ServiceAnnouncementValidationError([{ path: "maximumAppVersion", message: "최대 앱 버전 형식이 올바르지 않습니다." }]);
    }
    if (value.minimumAppVersion && value.maximumAppVersion && compareAppVersions(value.minimumAppVersion, value.maximumAppVersion) > 0) {
      throw new ServiceAnnouncementValidationError([{ path: "maximumAppVersion", message: "최대 앱 버전은 최소 앱 버전보다 낮을 수 없습니다." }]);
    }
    if (value.actionLabel && !value.appDeepLink && !value.externalUrl) {
      throw new ServiceAnnouncementValidationError([{ path: "actionLabel", message: "CTA 라벨에는 앱 딥링크 또는 외부 URL이 필요합니다." }]);
    }
    return value as ServiceAnnouncementWriteInput;
  }

  async list(input: Parameters<ServiceAnnouncementRepository["listAdmin"]>[0]) { return this.repository.listAdmin(input); }
  async getById(id: string) { return this.repository.getAdminById(id); }
  async listAudit(id: string, limit?: number) { return this.repository.listAudit(id, limit); }
  async listPushAttempts(id: string, limit?: number) {
    const items = await this.repository.listPushAttempts(id, limit);
    const summary = items.reduce((aggregate, item) => {
      const status = item.status === "sent" || item.status === "skipped" || item.status === "failed" || item.status === "queued" || item.status === "locked" || item.status === "completed"
        ? item.status
        : "failed";
      aggregate[status] += 1;
      return aggregate;
    }, { queued: 0, locked: 0, completed: 0, failed: 0, sent: 0, skipped: 0 } as Record<string, number>);
    return { items, summary };
  }

  async createDraft(input: unknown, actor: ServiceAnnouncementAdminActor = {}) {
    const validated = this.validate(input, "draft");
    const created = await this.repository.createDraft(validated, actor.actorId);
    await this.audit("create", actor, null, created);
    return created;
  }

  async update(id: string, input: unknown, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    const merged = { ...before, ...(input as Record<string, unknown>) };
    const validated = this.validate(merged, before.publicationState === "draft" ? "draft" : "publish");
    const updated = await this.repository.update(id, validated, actor.actorId);
    await this.audit("update", actor, before, updated);
    if (before.publicationState !== "draft") this.options.invalidateCache();
    return updated;
  }

  async publish(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    if (before.publicationState === "published") return before;
    this.validate(before, "publish");
    const published = await this.dispatchUnitOfWork.run(async (repositories) => {
      const next = await repositories.announcements.transition(id, {
        publicationState: "published",
        publishedAt: before.publishedAt ?? this.now(),
        archivedAt: null,
        pushStatus: actor.sendPush ?? before.pushEnabled ? "queued" : "not_requested",
      }, actor.actorId);
      await repositories.announcements.writeAudit({ announcementId: id, action: "publish", actorId: actor.actorId, reason: actor.reason, before, after: next });
      if (actor.sendPush ?? next.pushEnabled) await this.enqueueDispatch(repositories, next, actor);
      return next;
    });
    this.options.invalidateCache();
    return published;
  }

  async resolve(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    const after = await this.repository.transition(id, { resolvedAt: this.now() }, actor.actorId);
    await this.audit("resolve", actor, before, after);
    this.options.invalidateCache();
    return after;
  }

  async archive(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    const after = await this.repository.transition(id, { publicationState: "archived", archivedAt: this.now() }, actor.actorId);
    await this.audit("archive", actor, before, after);
    this.options.invalidateCache();
    return after;
  }

  async delete(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    const after = await this.repository.softDelete(id, this.now(), actor.actorId);
    await this.audit("delete", actor, before, after);
    this.options.invalidateCache();
    return after;
  }

  async bumpAttention(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const before = await this.existing(id);
    const after = await this.repository.bumpAttention(id, actor.actorId);
    await this.audit("bump_attention", actor, before, after);
    this.options.invalidateCache();
    return after;
  }

  async resend(id: string, actor: ServiceAnnouncementAdminActor = {}) {
    const announcement = await this.existing(id);
    if (announcement.publicationState !== "published") throw new Error("service_announcement_not_published");
    const result = await this.dispatchUnitOfWork.run(async (repositories) => {
      const dispatch = await this.enqueueDispatch(repositories, announcement, actor, true);
      await repositories.announcements.writeAudit({ announcementId: id, action: "resend", actorId: actor.actorId, reason: actor.reason, before: announcement, after: announcement });
      return { status: "queued" as const, eventId: dispatch.eventId };
    });
    return result;
  }

  private async enqueueDispatch(
    repositories: ServiceAnnouncementDispatchRepositories,
    announcement: AdminServiceAnnouncement,
    actor: ServiceAnnouncementAdminActor,
    allowDuplicate = false,
  ): Promise<{ eventId: string }> {
    if (!allowDuplicate && await repositories.announcements.hasSuccessfulPush(announcement.id, announcement.attentionRevision)) {
      throw new Error("service_announcement_push_already_sent");
    }
    const dispatchId = allowDuplicate
      ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      : "publish";
    const event = buildServiceAnnouncementEvent(announcement, dispatchId, this.now());
    await repositories.announcements.createPushAttempt({
      announcementId: announcement.id,
      attentionRevision: announcement.attentionRevision,
      eventId: event.id,
      status: "queued",
      requestedBy: actor.actorId,
    });
    const persisted = await repositories.platformEvents.createIfNotExists(event);
    await repositories.notificationJobs.enqueue({ eventId: persisted.eventId, priority: 5 });
    return { eventId: persisted.eventId };
  }

  private async existing(id: string): Promise<AdminServiceAnnouncement> {
    const value = await this.repository.getAdminById(id);
    if (!value || value.deletedAt) throw new Error("service_announcement_not_found");
    return value;
  }

  private async audit(action: string, actor: ServiceAnnouncementAdminActor, before: unknown, after: AdminServiceAnnouncement) {
    await this.repository.writeAudit({ announcementId: after.id, action, actorId: actor.actorId, reason: actor.reason, before, after });
  }

  private throwValidation(error: z.ZodError): never {
    throw new ServiceAnnouncementValidationError(error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  }
}

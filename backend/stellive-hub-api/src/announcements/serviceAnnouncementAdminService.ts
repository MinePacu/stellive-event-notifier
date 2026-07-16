import { z } from "zod";
import type { PushSendResult } from "../push/fcmClient.js";
import type { ServiceAnnouncementInput } from "../push/serviceAnnouncement.js";
import { serviceAnnouncementTopic } from "../push/serviceAnnouncement.js";
import {
  ServiceAnnouncementRepository,
  compareAppVersions,
  type AdminServiceAnnouncement,
  type ServiceAnnouncementWriteInput,
} from "./serviceAnnouncementRepository.js";

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

interface AnnouncementSender {
  send(input: ServiceAnnouncementInput): Promise<PushSendResult>;
}

const scopeByType = {
  general: "service_all",
  incident: "service_incident",
  maintenance: "service_maintenance",
  version_update: "service_version_update",
} as const;

export class ServiceAnnouncementAdminService {
  constructor(private readonly options: {
    repository?: ServiceAnnouncementRepository;
    sender: AnnouncementSender;
    invalidateCache: () => void;
    now?: () => Date;
  }) {}

  private get repository() { return this.options.repository ??= new ServiceAnnouncementRepository(); }
  private get now() { return this.options.now ?? (() => new Date()); }

  validate(input: unknown, mode: "draft" | "publish" = "publish"): ServiceAnnouncementWriteInput {
    if (mode === "draft") {
      const draft = draftSchema.safeParse(input);
      if (!draft.success) this.throwValidation(draft.error);
      return draft.data as ServiceAnnouncementWriteInput;
    }
    const result = writeSchema.safeParse(input);
    if (!result.success) this.throwValidation(result.error);
    const value = result.data;
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
  async listPushAttempts(id: string, limit?: number) { return this.repository.listPushAttempts(id, limit); }

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
    const published = await this.repository.transition(id, {
      publicationState: "published",
      publishedAt: before.publishedAt ?? this.now(),
      archivedAt: null,
      pushStatus: actor.sendPush ?? before.pushEnabled ? "pending" : "not_requested",
    }, actor.actorId);
    await this.audit("publish", actor, before, published);
    this.options.invalidateCache();
    if (actor.sendPush ?? published.pushEnabled) await this.sendPush(published, actor, false);
    return this.existing(id);
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
    const result = await this.sendPush(announcement, actor, true);
    await this.audit("resend", actor, announcement, await this.existing(id));
    return result;
  }

  private async sendPush(announcement: AdminServiceAnnouncement, actor: ServiceAnnouncementAdminActor, allowDuplicate: boolean) {
    if (!allowDuplicate && await this.repository.hasSuccessfulPush(announcement.id, announcement.attentionRevision)) {
      return { status: "duplicate_skipped" as const };
    }
    const scope = scopeByType[announcement.type as keyof typeof scopeByType];
    const topic = serviceAnnouncementTopic(scope);
    const attemptId = await this.repository.createPushAttempt({
      announcementId: announcement.id,
      attentionRevision: announcement.attentionRevision,
      topic,
      requestedBy: actor.actorId,
    });
    let result: PushSendResult;
    try {
      result = await this.options.sender.send({
        scope,
        title: announcement.title,
        body: announcement.summary,
        appDeepLink: announcement.appDeepLink || `stellivehub://announcements/${announcement.id}`,
        platformUrl: announcement.externalUrl || "",
      });
    } catch (error) {
      result = { status: "transient_failure", providerErrorCode: "sender_exception", reason: error instanceof Error ? error.message : "unknown" };
    }
    const status = result.status === "sent" ? "sent" : "failed";
    await this.repository.completePushAttempt(attemptId, {
      status,
      providerMessageId: result.providerMessageId,
      providerErrorCode: result.providerErrorCode,
      retryAfterMs: result.retryAfterMs,
      completedAt: this.now(),
    });
    await this.repository.markPushResult(announcement.id, {
      pushStatus: status,
      pushSentAt: status === "sent" ? this.now() : undefined,
    });
    return { status, providerMessageId: result.providerMessageId, providerErrorCode: result.providerErrorCode, retryAfterMs: result.retryAfterMs };
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

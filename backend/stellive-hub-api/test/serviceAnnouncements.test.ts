import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
import BootstrapService from "../src/mobile/bootstrapService.js";
import { loadEnv } from "../src/config/env.js";
import { ServiceAnnouncementAdminService } from "../src/announcements/serviceAnnouncementAdminService.js";
import { ServiceAnnouncementReadService } from "../src/announcements/serviceAnnouncementReadService.js";
import {
  ServiceAnnouncementRepository,
  isAnnouncementVisibleToClient,
  type AdminServiceAnnouncement,
  type ServiceAnnouncementRecord,
} from "../src/announcements/serviceAnnouncementRepository.js";
import { registerAdminServiceAnnouncementRoutes } from "../src/routes/adminServiceAnnouncementRoutes.js";

const now = new Date("2026-07-16T09:00:00.000Z");

function record(overrides: Partial<ServiceAnnouncementRecord> = {}): ServiceAnnouncementRecord {
  return {
    id: "notice-1", type: "incident", severity: "critical", publicationState: "published",
    title: "장애 안내", summary: "일부 알림이 지연됩니다.", body: "복구를 진행하고 있습니다.",
    isPinned: true, targetPlatforms: ["android", "ios"], minimumAppVersion: null, maximumAppVersion: null,
    appDeepLink: null, externalUrl: null, actionLabel: null, publishedAt: new Date("2026-07-16T08:00:00Z"),
    expiresAt: null, resolvedAt: null, archivedAt: null, deletedAt: null, pushEnabled: true,
    pushStatus: "not_requested", pushSentAt: null, attentionRevision: 1, revision: 1,
    createdBy: "admin", updatedBy: "admin", createdAt: new Date("2026-07-16T08:00:00Z"), updatedAt: new Date("2026-07-16T08:00:00Z"),
    ...overrides,
  };
}

describe("service announcement public policy", () => {
  it("hides drafts, expired, archived by default, platform mismatches, and version mismatches", () => {
    expect(isAnnouncementVisibleToClient(record({ publicationState: "draft" }), { platform: "android", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ expiresAt: new Date("2026-07-16T08:59:59Z") }), { platform: "android", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ publicationState: "archived" }), { platform: "android", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ publicationState: "archived" }), { platform: "android", includeArchived: true, now })).toBe(true);
    expect(isAnnouncementVisibleToClient(record({ deletedAt: now }), { platform: "android", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ targetPlatforms: ["ios"] }), { platform: "android", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ minimumAppVersion: "2.1.0" }), { platform: "android", appVersion: "2.0.9", now })).toBe(false);
    expect(isAnnouncementVisibleToClient(record({ maximumAppVersion: "2.1.0" }), { platform: "android", appVersion: "2.2.0", now })).toBe(false);
  });

  it("returns a public DTO without admin and internal push fields", async () => {
    const repository = new ServiceAnnouncementRepository({
      serviceAnnouncement: { findMany: vi.fn().mockResolvedValue([record()]) },
    } as never);
    const result = await repository.listPublic({ platform: "android", now });
    expect(result.items[0]).toMatchObject({ id: "notice-1", attentionRevision: 1 });
    expect(result.items[0]).not.toHaveProperty("pushStatus");
    expect(result.items[0]).not.toHaveProperty("createdBy");
    expect(result.items[0]).not.toHaveProperty("deletedAt");
  });
});

class MemoryAnnouncementRepository {
  value: AdminServiceAnnouncement = { ...record(), targetPlatforms: ["android", "ios"] };
  attempts: Array<{ id: string; status: string; attentionRevision: number }> = [];
  audits: string[] = [];
  async getAdminById() { return this.value; }
  async createDraft() { return this.value; }
  async listAdmin() { return { items: [this.value] }; }
  async listAudit() { return []; }
  async listPushAttempts() { return this.attempts; }
  async update(_id: string, input: Record<string, unknown>) { this.value = { ...this.value, ...input, revision: this.value.revision + 1 } as AdminServiceAnnouncement; return this.value; }
  async transition(_id: string, data: Record<string, unknown>) { this.value = { ...this.value, ...data, revision: this.value.revision + 1 } as AdminServiceAnnouncement; return this.value; }
  async bumpAttention() { this.value = { ...this.value, attentionRevision: this.value.attentionRevision + 1, revision: this.value.revision + 1 }; return this.value; }
  async softDelete(_id: string, deletedAt: Date, actorId?: string) { this.value = { ...this.value, deletedAt, updatedBy: actorId ?? null, revision: this.value.revision + 1 }; return this.value; }
  async writeAudit(input: { action: string }) { this.audits.push(input.action); }
  async hasSuccessfulPush(_id: string, revision: number) { return this.attempts.some((item) => item.attentionRevision === revision && item.status === "sent"); }
  async createPushAttempt(input: { attentionRevision: number }) { const id = `attempt-${this.attempts.length + 1}`; this.attempts.push({ id, status: "sending", attentionRevision: input.attentionRevision }); return id; }
  async completePushAttempt(id: string, input: { status: string }) { this.attempts.find((item) => item.id === id)!.status = input.status; }
  async markPushResult(_id: string, input: { pushStatus: string; pushSentAt?: Date }) { this.value = { ...this.value, ...input }; }
}

describe("service announcement publish flow", () => {
  it("keeps a committed publication when FCM fails and does not duplicate publish", async () => {
    const repository = new MemoryAnnouncementRepository();
    repository.value = { ...repository.value, publicationState: "draft", publishedAt: null };
    const send = vi.fn().mockResolvedValue({ status: "transient_failure", providerErrorCode: "fcm_unavailable" });
    const invalidateCache = vi.fn();
    const service = new ServiceAnnouncementAdminService({ repository: repository as never, sender: { send }, invalidateCache, now: () => now });

    const published = await service.publish("notice-1", { actorId: "admin", sendPush: true });
    expect(published.publicationState).toBe("published");
    expect(published.pushStatus).toBe("failed");
    expect(repository.attempts[0]?.status).toBe("failed");
    await service.publish("notice-1", { actorId: "admin", sendPush: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(invalidateCache).toHaveBeenCalledTimes(1);
  });

  it("allows explicit resend without bumping attention and bump-attention alone changes the read key", async () => {
    const repository = new MemoryAnnouncementRepository();
    const send = vi.fn().mockResolvedValue({ status: "sent", providerMessageId: "fcm-1" });
    const service = new ServiceAnnouncementAdminService({ repository: repository as never, sender: { send }, invalidateCache: vi.fn(), now: () => now });
    await service.resend("notice-1", { actorId: "admin" });
    expect(repository.value.attentionRevision).toBe(1);
    expect(send.mock.calls[0][0].appDeepLink).toBe("stellivehub://announcements/notice-1");
    await service.bumpAttention("notice-1", { actorId: "admin" });
    expect(repository.value.attentionRevision).toBe(2);
    expect(repository.audits).toContain("bump_attention");
  });

  it("soft-deletes a selected announcement, audits it, and invalidates public summaries", async () => {
    const repository = new MemoryAnnouncementRepository();
    const invalidateCache = vi.fn();
    const service = new ServiceAnnouncementAdminService({
      repository: repository as never,
      sender: { send: vi.fn() },
      invalidateCache,
      now: () => now,
    });

    const deleted = await service.delete("notice-1", { actorId: "admin" });

    expect(deleted.deletedAt).toEqual(now);
    expect(deleted.revision).toBe(2);
    expect(repository.audits).toContain("delete");
    expect(invalidateCache).toHaveBeenCalledOnce();
    await expect(service.delete("notice-1", { actorId: "admin" })).rejects.toThrow("service_announcement_not_found");
  });
});

describe("service announcement admin deletion", () => {
  it("renders a delete action for the selected announcement", () => {
    const html = renderAdminConsoleHtml();
    expect(html).toContain('id="announcement-delete"');
    expect(html).toContain('method: "DELETE"');
  });

  it("dispatches authenticated DELETE requests to the admin service", async () => {
    const remove = vi.fn(async () => ({ id: "notice-1", deletedAt: now.toISOString() }));
    const app = Fastify();
    await registerAdminServiceAnnouncementRoutes(app, {
      env: loadEnv({ DATABASE_URL: "postgresql://test:test@localhost:5432/test", ADMIN_CONSOLE_ENABLED: true, ADMIN_CONSOLE_TOKEN: "admin-token" }),
      service: { delete: remove } as never,
    });

    const unauthorized = await app.inject({ method: "DELETE", url: "/v1/admin/announcements/notice-1" });
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/admin/announcements/notice-1",
      headers: { authorization: "Bearer admin-token" },
    });
    await app.close();

    expect(unauthorized.statusCode).toBe(401);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "notice-1" });
    expect(remove).toHaveBeenCalledWith("notice-1", { actorId: "admin", reason: undefined, sendPush: undefined });
  });
});

describe("announcement summary caching and bootstrap", () => {
  it("invalidates the short TTL summary cache", async () => {
    let activeCount = 1;
    const repository = { summary: vi.fn(async () => ({ activeCount, items: [], generatedAt: now.toISOString() })) };
    const reads = new ServiceAnnouncementReadService(repository as never, 30_000);
    expect((await reads.summary({ platform: "android" })).activeCount).toBe(1);
    activeCount = 2;
    expect((await reads.summary({ platform: "android" })).activeCount).toBe(1);
    reads.invalidate();
    expect((await reads.summary({ platform: "android" })).activeCount).toBe(2);
  });

  it("adds an optional platform-aware summary to bootstrap", async () => {
    const summary = { activeCount: 1, items: [], generatedAt: now.toISOString() };
    const service = new BootstrapService({
      catalog: { getGenerations: () => [], getMembers: () => [] },
      devices: { getDevice: async () => undefined }, preferences: { listForDevice: async () => [] },
      liveStatus: { listDiagnostics: async () => [] }, hubEvents: { summary: async () => ({ openCount: 0, upcomingCount: 0, closingSoonCount: 0, preview: [] }) },
      announcements: { summary: vi.fn(async () => summary) }, clock: () => now,
    });
    const response = await service.getBootstrap({ platform: "ios", appVersion: "1.2.3" });
    expect(response.announcementsSummary).toEqual(summary);
  });
});

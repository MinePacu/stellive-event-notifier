import { createPrismaAdvisoryLockRunner, type LogRetentionLockRunner } from "./logRetentionScheduler.js";

// Distinct from the log retention lock key so the two jobs never block each other.
const YOUTUBE_WEBSUB_RENEWAL_LOCK_KEY = 7_301_964_120_002n;
export const YOUTUBE_WEBSUB_RENEWAL_RETRY_COOLDOWN_MS = 6 * 3_600_000;

export function createYoutubeWebSubRenewalLockRunner(): LogRetentionLockRunner {
  return createPrismaAdvisoryLockRunner(undefined, YOUTUBE_WEBSUB_RENEWAL_LOCK_KEY);
}

export function shouldStartYoutubeWebSubRenewal(
  env: { HUB_EVENTS_STORAGE_MODE: string; YOUTUBE_WEBSUB_AUTO_RENEW_ENABLED: boolean; NODE_ENV: string },
  options: { dependenciesInjected?: boolean } = {}
): boolean {
  return (
    env.HUB_EVENTS_STORAGE_MODE === "prisma" &&
    env.YOUTUBE_WEBSUB_AUTO_RENEW_ENABLED &&
    env.NODE_ENV !== "test" &&
    !options.dependenciesInjected
  );
}

interface RenewalSummary {
  status: string;
  renewed: number;
  failed: number;
  skipped: number;
}

export interface RenewalTarget {
  targetId: string;
  channelId: string;
  topicUrl: string;
}

export interface RenewalLeaseRow {
  targetId: string;
  topicUrl: string;
  status: string;
  leaseExpiresAt: Date | null;
  updatedAt: Date;
}

export type RenewalDecision =
  | { due: false; reason: "healthy" | "cooldown" }
  | { due: true; reason: "missing_row" | "needs_renewal" };

/**
 * Renewal is due when a target has no row (always renew), or a row is not active / has no lease / expires within
 * `renewBeforeMs` AND the last attempt (latest updatedAt among such rows, a persisted signal) is older than the cooldown.
 */
export function decideYoutubeWebSubRenewal(input: {
  targets: RenewalTarget[];
  rows: RenewalLeaseRow[];
  now: Date;
  renewBeforeMs: number;
  cooldownMs?: number;
}): RenewalDecision {
  const cooldownMs = input.cooldownMs ?? YOUTUBE_WEBSUB_RENEWAL_RETRY_COOLDOWN_MS;
  const rowsByKey = new Map(input.rows.map((row) => [`${row.targetId}\u0000${row.topicUrl}`, row]));
  const nowMs = input.now.getTime();
  let latestAttemptMs = -Infinity;
  let needsRenewal = false;

  for (const target of input.targets) {
    if (!target.channelId || !target.topicUrl) continue;
    const row = rowsByKey.get(`${target.targetId}\u0000${target.topicUrl}`);
    if (!row) return { due: true, reason: "missing_row" };
    const expiring =
      row.status !== "active" || !row.leaseExpiresAt || row.leaseExpiresAt.getTime() - nowMs <= input.renewBeforeMs;
    if (expiring) {
      needsRenewal = true;
      latestAttemptMs = Math.max(latestAttemptMs, row.updatedAt.getTime());
    }
  }

  if (!needsRenewal) return { due: false, reason: "healthy" };
  if (nowMs - latestAttemptMs < cooldownMs) return { due: false, reason: "cooldown" };
  return { due: true, reason: "needs_renewal" };
}

interface RenewalLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface YoutubeWebSubRenewalSchedulerOptions {
  targets: RenewalTarget[];
  subscriptions: { listLeases(source: string): Promise<RenewalLeaseRow[]> };
  renewer: { renewSubscriptions(): Promise<RenewalSummary> | RenewalSummary };
  withLock: LogRetentionLockRunner;
  intervalMs: number;
  renewBeforeMs: number;
  cooldownMs?: number;
  initialDelayMs?: number;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  logger: RenewalLogger;
}

export interface YoutubeWebSubRenewalRunResult {
  acquired: boolean;
  renewed: boolean;
  reason?: RenewalDecision["reason"];
}

function defaultSetTimer(callback: () => void, delayMs: number): unknown {
  const handle = setTimeout(callback, delayMs);
  handle.unref();
  return handle;
}

function defaultClearTimer(handle: unknown): void {
  clearTimeout(handle as NodeJS.Timeout);
}

export class YoutubeWebSubRenewalScheduler {
  private timer: unknown;
  private started = false;
  private stopped = false;
  private inFlight: Promise<YoutubeWebSubRenewalRunResult> | undefined;

  constructor(private readonly options: YoutubeWebSubRenewalSchedulerOptions) {}

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.schedule(this.options.initialDelayMs ?? 60_000);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) (this.options.clearTimer ?? defaultClearTimer)(this.timer);
    this.timer = undefined;
    await this.inFlight?.catch(() => undefined);
  }

  /** Runs one check. Never rejects: failures are logged. */
  runOnce(): Promise<YoutubeWebSubRenewalRunResult> {
    this.inFlight ??= this.execute().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = (this.options.setTimer ?? defaultSetTimer)(() => {
      this.timer = undefined;
      if (this.stopped) return;
      void this.runOnce().finally(() => this.schedule(this.options.intervalMs));
    }, delayMs);
  }

  private async execute(): Promise<YoutubeWebSubRenewalRunResult> {
    const { logger } = this.options;
    const result: YoutubeWebSubRenewalRunResult = { acquired: false, renewed: false };
    try {
      const locked = await this.options.withLock(async () => {
        const decision = decideYoutubeWebSubRenewal({
          targets: this.options.targets,
          rows: await this.options.subscriptions.listLeases("youtube"),
          now: (this.options.now ?? (() => new Date()))(),
          renewBeforeMs: this.options.renewBeforeMs,
          cooldownMs: this.options.cooldownMs,
        });
        result.reason = decision.reason;
        if (!decision.due) return;
        const summary = await this.options.renewer.renewSubscriptions();
        result.renewed = true;
        logger.info(
          { reason: decision.reason, renewed: summary.renewed, failed: summary.failed, skipped: summary.skipped },
          "youtube websub auto renewal completed"
        );
      });
      result.acquired = locked.acquired;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : "unknown_error" }, "youtube websub auto renewal failed");
    }
    return result;
  }
}

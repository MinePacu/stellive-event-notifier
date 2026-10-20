import { getPrismaClient } from "../storage/prisma.js";

// Arbitrary constant key; every API process uses the same one so only a single process prunes at a time.
const LOG_RETENTION_LOCK_KEY = 7_301_964_120_001n;
const LOCK_TRANSACTION_TIMEOUT_MS = 15 * 60_000;

export type LogRetentionLockResult<T> = { acquired: true; value: T } | { acquired: false };
export type LogRetentionLockRunner = <T>(task: () => Promise<T>) => Promise<LogRetentionLockResult<T>>;

interface AdvisoryLockClient {
  $transaction<T>(
    fn: (tx: { $queryRaw<R = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<R> }) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T>;
}

/**
 * Holds a transaction-level advisory lock for the duration of `task`.
 * The lock is only a mutex: the task's own statements commit independently on other pool connections,
 * so batched deletes stay small. The lock is released on commit/rollback or if the process dies.
 */
export function createPrismaAdvisoryLockRunner(
  prisma: AdvisoryLockClient = getPrismaClient() as unknown as AdvisoryLockClient,
  key: bigint = LOG_RETENTION_LOCK_KEY
): LogRetentionLockRunner {
  return <T>(task: () => Promise<T>) =>
    prisma.$transaction(
      async (tx): Promise<LogRetentionLockResult<T>> => {
        const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
        if (!rows[0]?.locked) return { acquired: false };
        return { acquired: true, value: await task() };
      },
      { maxWait: 5_000, timeout: LOCK_TRANSACTION_TIMEOUT_MS }
    );
}

export function shouldStartLogRetention(
  env: { HUB_EVENTS_STORAGE_MODE: string; LOG_RETENTION_ENABLED: boolean; NODE_ENV: string },
  options: { dependenciesInjected?: boolean } = {}
): boolean {
  return (
    env.HUB_EVENTS_STORAGE_MODE === "prisma" &&
    env.LOG_RETENTION_ENABLED &&
    env.NODE_ENV !== "test" &&
    !options.dependenciesInjected
  );
}

interface LogRetentionLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface LogRetentionSchedulerOptions {
  deliveryAttempts: {
    pruneOlderThan(input: { days: number; now: Date; shouldContinue?: () => boolean }): Promise<{ deleted: number }>;
  };
  externalApiCallLogs: {
    pruneOlderThan(input: { days: number; now: Date }): Promise<{ deleted: number }>;
  };
  withLock: LogRetentionLockRunner;
  deliveryAttemptRetentionDays: number;
  externalApiLogRetentionDays: number;
  intervalMs: number;
  initialDelayMs?: number;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  logger: LogRetentionLogger;
}

export interface LogRetentionRunResult {
  acquired: boolean;
  deliveryAttemptsDeleted: number;
  externalApiCallsDeleted: number;
}

function defaultSetTimer(callback: () => void, delayMs: number): unknown {
  const handle = setTimeout(callback, delayMs);
  handle.unref();
  return handle;
}

function defaultClearTimer(handle: unknown): void {
  clearTimeout(handle as NodeJS.Timeout);
}

export class LogRetentionScheduler {
  private timer: unknown;
  private started = false;
  private stopped = false;
  private inFlight: Promise<LogRetentionRunResult> | undefined;

  constructor(private readonly options: LogRetentionSchedulerOptions) {}

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

  /** Runs one prune cycle. Never rejects: failures are logged. */
  runOnce(): Promise<LogRetentionRunResult> {
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

  private async execute(): Promise<LogRetentionRunResult> {
    const { logger } = this.options;
    const now = (this.options.now ?? (() => new Date()))();
    const result: LogRetentionRunResult = { acquired: false, deliveryAttemptsDeleted: 0, externalApiCallsDeleted: 0 };
    try {
      const locked = await this.options.withLock(async () => {
        result.deliveryAttemptsDeleted = await this.prune("DeliveryAttempt", () =>
          this.options.deliveryAttempts.pruneOlderThan({
            days: this.options.deliveryAttemptRetentionDays,
            now,
            shouldContinue: () => !this.stopped
          })
        );
        if (this.stopped) return;
        result.externalApiCallsDeleted = await this.prune("ExternalApiCallLog", () =>
          this.options.externalApiCallLogs.pruneOlderThan({ days: this.options.externalApiLogRetentionDays, now })
        );
      });
      result.acquired = locked.acquired;
    } catch (error) {
      logger.error({ table: "lock", error: errorMessage(error) }, "log retention prune failed");
      return result;
    }
    if (result.acquired) {
      logger.info(
        { deliveryAttemptsDeleted: result.deliveryAttemptsDeleted, externalApiCallsDeleted: result.externalApiCallsDeleted },
        "log retention prune completed"
      );
    }
    return result;
  }

  private async prune(table: string, run: () => Promise<{ deleted: number }>): Promise<number> {
    try {
      return (await run()).deleted;
    } catch (error) {
      this.options.logger.error({ table, error: errorMessage(error) }, "log retention prune failed");
      return 0;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

import type { ServiceTopicSyncResult } from "./serviceTopicSubscription.js";

export interface ServiceTopicReconciliationSummary {
  processed: number;
  synced: number;
  tokenMissing: number;
  disabled: number;
  transientFailure: number;
  retries: number;
  success: boolean;
}

export interface ServiceTopicReconciliationDependencies {
  devices: {
    listPushTargetsPage(input: { cursor?: string; limit: number }): Promise<{
      items: Array<{ deviceId: string }>;
      nextCursor: string | null;
    }>;
  };
  subscriptions: {
    syncDevice(input: { deviceId: string }): Promise<ServiceTopicSyncResult>;
  };
}

export interface ServiceTopicReconciliationOptions {
  pageSize?: number;
  concurrency?: number;
  maxAttempts?: number;
}

type FinalSyncStatus = ServiceTopicSyncResult["status"];

async function syncWithRetry(
  deviceId: string,
  dependencies: ServiceTopicReconciliationDependencies,
  maxAttempts: number,
): Promise<{ status: FinalSyncStatus; retries: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: ServiceTopicSyncResult;
    try {
      result = await dependencies.subscriptions.syncDevice({ deviceId });
    } catch {
      result = { status: "transient_failure" };
    }
    if (result.status !== "transient_failure" || attempt === maxAttempts) {
      return { status: result.status, retries: attempt - 1 };
    }
  }
  return { status: "transient_failure", retries: maxAttempts - 1 };
}

export async function reconcileServiceTopicSubscriptions(
  dependencies: ServiceTopicReconciliationDependencies,
  options: ServiceTopicReconciliationOptions = {},
): Promise<ServiceTopicReconciliationSummary> {
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? 500));
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 10));
  const maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 3));
  const summary: ServiceTopicReconciliationSummary = {
    processed: 0,
    synced: 0,
    tokenMissing: 0,
    disabled: 0,
    transientFailure: 0,
    retries: 0,
    success: true,
  };

  let cursor: string | undefined;
  do {
    const page = await dependencies.devices.listPushTargetsPage({ cursor, limit: pageSize });
    for (let offset = 0; offset < page.items.length; offset += concurrency) {
      const batch = page.items.slice(offset, offset + concurrency);
      const results = await Promise.all(
        batch.map((device) => syncWithRetry(device.deviceId, dependencies, maxAttempts)),
      );
      for (const result of results) {
        summary.processed += 1;
        summary.retries += result.retries;
        if (result.status === "synced") summary.synced += 1;
        if (result.status === "token_missing") summary.tokenMissing += 1;
        if (result.status === "disabled") summary.disabled += 1;
        if (result.status === "transient_failure") summary.transientFailure += 1;
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  summary.success = summary.disabled === 0 && summary.transientFailure === 0;
  return summary;
}

import type { ExternalApiCallResultStatus } from "../admin/adminTypes.js";
import type { RecordExternalApiCallInput } from "../repositories/externalApiCallLogRepository.js";

export interface ExternalApiCallLogger {
  record(input: RecordExternalApiCallInput): Promise<void>;
}

export function resultStatusFromHttpStatus(status: number, options: { quotaStatusCode?: number } = {}): ExternalApiCallResultStatus {
  if (status >= 200 && status < 300) return "ok";
  if (status === 304) return "not_modified";
  if (status === options.quotaStatusCode) return "quota_exceeded";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth_required";
  return "http_error";
}

export function resultStatusFromError(error: unknown): ExternalApiCallResultStatus {
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  return "network_error";
}

export async function recordExternalApiCall(
  logger: ExternalApiCallLogger | undefined,
  input: Omit<RecordExternalApiCallInput, "completedAt" | "durationMs"> & {
    completedAt?: Date;
    durationMs?: number;
  }
): Promise<void> {
  if (!logger) return;
  try {
    const safeUrl = new URL(input.url);
    safeUrl.search = "";
    safeUrl.hash = "";
    await logger.record({
      ...input,
      url: safeUrl.toString(),
      completedAt: input.completedAt ?? new Date(),
      durationMs: input.durationMs ?? Math.max(0, Date.now() - input.requestedAt.getTime())
    });
  } catch {
    // Observability must never break the external API caller.
  }
}

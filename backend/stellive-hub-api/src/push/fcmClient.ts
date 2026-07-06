import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Message, MulticastMessage } from "firebase-admin/messaging";
import { readFileSync } from "node:fs";

import type { MinimalPushPayload } from "./pushPayloadFactory.js";
import type { FcmRateLimiter } from "./fcmRateLimiter.js";

export type PushSendStatus =
  | "sent"
  | "disabled"
  | "transient_failure"
  | "permanent_token_failure";

export interface PushSendResult {
  status: PushSendStatus;
  providerMessageId?: string;
  providerErrorCode?: string;
  reason?: string;
  retryAfterMs?: number;
}

export interface FirebaseMessageSender {
  send(message: Message): Promise<string>;
  sendEachForMulticast?(message: MulticastMessage): Promise<{
    responses: Array<{ success: boolean; messageId?: string; error?: unknown }>;
    successCount: number;
    failureCount: number;
  }>;
  subscribeToTopic?(registrationTokens: string | string[], topic: string): Promise<unknown>;
  unsubscribeFromTopic?(registrationTokens: string | string[], topic: string): Promise<unknown>;
}

export interface FcmClientConfig {
  serviceAccountFile?: string;
  serviceAccountFileReader?: (path: string) => string | Promise<string>;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  appName?: string;
  sender?: FirebaseMessageSender;
  senderFactory?: (credentials: FirebaseCredentialConfig) => FirebaseMessageSender;
  rateLimiter?: FcmRateLimiter;
}

export interface FirebaseCredentialConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface FcmSendInput {
  token: string;
  payload: MinimalPushPayload;
}

export interface FcmClient {
  enabled: boolean;
  send(input: FcmSendInput): Promise<PushSendResult>;
  sendEach(input: { tokens: string[]; payload: MinimalPushPayload }): Promise<PushSendResult[]>;
  sendToTopic(input: { topic: string; title: string; body: string; appDeepLink: string; platformUrl: string }): Promise<PushSendResult>;
  setTopicSubscriptions(input: { token: string; topics: readonly string[]; enabled: boolean }): Promise<{
    status: "synced" | "disabled" | "transient_failure";
    failedTopics?: string[];
  }>;
}

function isConfiguredSecret(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== "verify_required" && !normalized.startsWith("replace_with_");
}

function hasFirebaseConfig(config: FcmClientConfig): boolean {
  return (
    isConfiguredSecret(config.projectId) &&
    isConfiguredSecret(config.clientEmail) &&
    isConfiguredSecret(config.privateKey)
  );
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

function findOrInitializeApp(config: FirebaseCredentialConfig & {
  appName?: string;
}): App {
  const appName = config.appName ?? `stellive-hub-api-${config.projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: normalizePrivateKey(config.privateKey)
      }),
      projectId: config.projectId
    },
    appName
  );
}

function createDefaultSender(config: FirebaseCredentialConfig & Pick<FcmClientConfig, "appName">): FirebaseMessageSender {
  const app = findOrInitializeApp({
    projectId: config.projectId ?? "",
    clientEmail: config.clientEmail ?? "",
    privateKey: config.privateKey ?? "",
    appName: config.appName
  });
  return getMessaging(app);
}

type CredentialResolution =
  | { credentials: FirebaseCredentialConfig }
  | { reason: "fcm_not_configured" | "fcm_invalid_service_account_file" };

function resolveCredentials(config: FcmClientConfig): CredentialResolution {
  if (isConfiguredSecret(config.serviceAccountFile)) {
    try {
      const reader = config.serviceAccountFileReader ?? ((path: string) => readFileSync(path, "utf8"));
      const contents = reader(config.serviceAccountFile!);
      if (typeof contents !== "string") return { reason: "fcm_invalid_service_account_file" };
      const parsed = JSON.parse(contents) as Record<string, unknown>;
      const projectId = typeof parsed.project_id === "string" ? parsed.project_id : undefined;
      const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email : undefined;
      const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : undefined;
      if (!isConfiguredSecret(projectId) || !isConfiguredSecret(clientEmail) || !isConfiguredSecret(privateKey)) {
        return { reason: "fcm_invalid_service_account_file" };
      }
      return {
        credentials: {
          projectId: projectId!,
          clientEmail: clientEmail!,
          privateKey: normalizePrivateKey(privateKey!)
        }
      };
    } catch {
      return { reason: "fcm_invalid_service_account_file" };
    }
  }
  if (!hasFirebaseConfig(config)) return { reason: "fcm_not_configured" };
  return {
    credentials: {
      projectId: config.projectId!,
      clientEmail: config.clientEmail!,
      privateKey: normalizePrivateKey(config.privateKey!)
    }
  };
}

function disabledClient(reason: "fcm_not_configured" | "fcm_invalid_service_account_file"): FcmClient {
  return {
    enabled: false,
    async send() { return { status: "disabled", reason }; },
    async sendEach(input) { return input.tokens.map(() => ({ status: "disabled", reason })); },
    async sendToTopic() { return { status: "disabled", reason }; },
    async setTopicSubscriptions() { return { status: "disabled" }; }
  };
}

function toFirebaseMessage(input: FcmSendInput): Message {
  return {
    token: input.token,
    notification: input.payload.notification,
    data: input.payload.data,
    android: {
      priority: input.payload.android.priority,
      ...(input.payload.android.notification ? { notification: input.payload.android.notification } : {})
    },
    apns: input.payload.apns
  };
}

function providerErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "fcm_unknown_error";
}

function providerRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("retryAfterMs" in error)) return undefined;
  const value = (error as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeProviderError(error: unknown): PushSendResult {
  const code = providerErrorCode(error);
  if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
    return { status: "permanent_token_failure", providerErrorCode: code, reason: code };
  }
  return { status: "transient_failure", providerErrorCode: code, reason: code, retryAfterMs: providerRetryAfterMs(error) };
}

function rateLimited(retryAfterMs: number | undefined): PushSendResult {
  return { status: "transient_failure", providerErrorCode: "fcm_rate_limited", reason: "fcm_rate_limited", retryAfterMs };
}

export function createFcmClient(config: FcmClientConfig): FcmClient {
  const resolution = resolveCredentials(config);
  if ("reason" in resolution) return disabledClient(resolution.reason);
  const resolvedConfig = { ...resolution.credentials, appName: config.appName };

  let sender = config.sender;
  const getSender = () => sender ??= config.senderFactory?.(resolution.credentials) ?? createDefaultSender(resolvedConfig);

  return {
    enabled: true,
    async send(input) {
      const decision = config.rateLimiter?.tryAcquire();
      if (decision && !decision.allowed) return rateLimited(decision.retryAfterMs);
      try {
        sender = getSender();
        const providerMessageId = await sender.send(toFirebaseMessage(input));
        return { status: "sent", providerMessageId };
      } catch (error) {
        return normalizeProviderError(error);
      }
    },
    async sendEach(input) {
      const results: PushSendResult[] = [];
      for (let offset = 0; offset < input.tokens.length; offset += 500) {
        const tokens = input.tokens.slice(offset, offset + 500);
        const decision = config.rateLimiter?.tryAcquire(tokens.length);
        if (decision && !decision.allowed) {
          results.push(...tokens.map(() => rateLimited(decision.retryAfterMs)));
          continue;
        }
        try {
          sender = getSender();
          if (!sender.sendEachForMulticast) {
            for (const token of tokens) {
              try {
                const providerMessageId = await sender.send(toFirebaseMessage({ token, payload: input.payload }));
                results.push({ status: "sent", providerMessageId });
              } catch (error) {
                results.push(normalizeProviderError(error));
              }
            }
            continue;
          }
          const response = await sender.sendEachForMulticast({
            tokens,
            notification: input.payload.notification,
            data: input.payload.data,
            android: {
              priority: input.payload.android.priority,
              ...(input.payload.android.notification ? { notification: input.payload.android.notification } : {})
            },
            apns: input.payload.apns
          });
          results.push(...response.responses.map((item): PushSendResult =>
            item.success
              ? { status: "sent", providerMessageId: item.messageId }
              : normalizeProviderError(item.error)
          ));
        } catch (error) {
          results.push(...tokens.map(() => normalizeProviderError(error)));
        }
      }
      return results;
    },
    async sendToTopic(input) {
      const decision = config.rateLimiter?.tryAcquire();
      if (decision && !decision.allowed) return rateLimited(decision.retryAfterMs);
      try {
        sender = getSender();
        const providerMessageId = await sender.send({
          topic: input.topic,
          notification: { title: input.title, body: input.body },
          data: { appDeepLink: input.appDeepLink, platformUrl: input.platformUrl, tapAction: "open_app" }
        });
        return { status: "sent", providerMessageId };
      } catch (error) {
        return normalizeProviderError(error);
      }
    },
    async setTopicSubscriptions(input) {
      sender = getSender();
      const operation = input.enabled ? sender.subscribeToTopic : sender.unsubscribeFromTopic;
      if (!operation) return { status: "transient_failure", failedTopics: [...input.topics] };
      const failedTopics: string[] = [];
      for (const topic of input.topics) {
        try {
          await operation.call(sender, input.token, topic);
        } catch {
          failedTopics.push(topic);
        }
      }
      return failedTopics.length > 0 ? { status: "transient_failure", failedTopics } : { status: "synced" };
    }
  };
}

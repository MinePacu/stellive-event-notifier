import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Message } from "firebase-admin/messaging";

import type { MinimalPushPayload } from "./pushPayloadFactory.js";

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
}

export interface FirebaseMessageSender {
  send(message: Message): Promise<string>;
}

export interface FcmClientConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  appName?: string;
  sender?: FirebaseMessageSender;
}

export interface FcmSendInput {
  token: string;
  payload: MinimalPushPayload;
}

export interface FcmClient {
  enabled: boolean;
  send(input: FcmSendInput): Promise<PushSendResult>;
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

function findOrInitializeApp(config: Required<Pick<FcmClientConfig, "projectId" | "clientEmail" | "privateKey">> & {
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

function createDefaultSender(config: FcmClientConfig): FirebaseMessageSender {
  const app = findOrInitializeApp({
    projectId: config.projectId ?? "",
    clientEmail: config.clientEmail ?? "",
    privateKey: config.privateKey ?? "",
    appName: config.appName
  });
  return getMessaging(app);
}

function toFirebaseMessage(input: FcmSendInput): Message {
  return {
    token: input.token,
    notification: input.payload.notification,
    data: input.payload.data,
    android: {
      priority: input.payload.android.priority
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

function normalizeProviderError(error: unknown): PushSendResult {
  const code = providerErrorCode(error);
  if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
    return { status: "permanent_token_failure", providerErrorCode: code, reason: code };
  }
  return { status: "transient_failure", providerErrorCode: code, reason: code };
}

export function createFcmClient(config: FcmClientConfig): FcmClient {
  if (!hasFirebaseConfig(config)) {
    return {
      enabled: false,
      async send() {
        return { status: "disabled", reason: "fcm_not_configured" };
      }
    };
  }

  let sender = config.sender;

  return {
    enabled: true,
    async send(input) {
      try {
        sender ??= createDefaultSender(config);
        const providerMessageId = await sender.send(toFirebaseMessage(input));
        return { status: "sent", providerMessageId };
      } catch (error) {
        return normalizeProviderError(error);
      }
    }
  };
}

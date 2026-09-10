import "dotenv/config";
import { createDefaultFcmClient } from "../app.js";
import { loadEnv } from "../config/env.js";
import { reconcileServiceTopicSubscriptions } from "../push/serviceTopicReconciliation.js";
import { ServiceTopicSubscriptionService } from "../push/serviceTopicSubscription.js";
import DeviceRepository from "../repositories/deviceRepository.js";
import PreferenceRepository from "../repositories/preferenceRepository.js";
import { disconnectPrismaClient } from "../storage/prisma.js";

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const fcmClient = createDefaultFcmClient(env);
  if (!fcmClient.enabled) {
    console.error(JSON.stringify({ operation: "service_topic_reconcile", status: "failed", reason: "fcm_disabled" }));
    process.exitCode = 1;
    return;
  }

  const devices = new DeviceRepository();
  const subscriptions = new ServiceTopicSubscriptionService({
    fcmClient,
    devices,
    preferences: new PreferenceRepository(),
  });
  const summary = await reconcileServiceTopicSubscriptions({ devices, subscriptions });
  console.info(JSON.stringify({ operation: "service_topic_reconcile", ...summary }));
  if (!summary.success) process.exitCode = 1;
}

try {
  await main();
} catch {
  console.error(JSON.stringify({ operation: "service_topic_reconcile", status: "failed", reason: "unexpected_error" }));
  process.exitCode = 1;
} finally {
  await disconnectPrismaClient();
}

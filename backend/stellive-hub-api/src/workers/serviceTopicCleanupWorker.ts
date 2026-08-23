import "dotenv/config";
import { createDefaultFcmClient } from "../app.js";
import { loadEnv } from "../config/env.js";
import DeviceRepository from "../repositories/deviceRepository.js";
import { cleanupLegacyServiceTopics } from "../push/legacyServiceTopicCleanup.js";
import { disconnectPrismaClient } from "../storage/prisma.js";

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const fcmClient = createDefaultFcmClient(env);
  if (!fcmClient.enabled) {
    console.error(JSON.stringify({ operation: "legacy_service_topic_cleanup", status: "failed", reason: "fcm_disabled" }));
    process.exitCode = 1;
    return;
  }
  const summary = await cleanupLegacyServiceTopics({ devices: new DeviceRepository(), fcmClient });
  console.info(JSON.stringify({ operation: "legacy_service_topic_cleanup", ...summary }));
  if (summary.failed > 0) process.exitCode = 1;
}

try {
  await main();
} catch {
  console.error(JSON.stringify({ operation: "legacy_service_topic_cleanup", status: "failed", reason: "unexpected_error" }));
  process.exitCode = 1;
} finally {
  await disconnectPrismaClient();
}

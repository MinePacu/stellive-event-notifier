import "dotenv/config";
import { buildApp } from "./app.js";
import { createGracefulShutdown } from "./process/gracefulShutdown.js";
import { disconnectPrismaClient } from "./storage/prisma.js";

const port = Number(process.env.PORT ?? 4000);
const app = await buildApp();
const shutdown = createGracefulShutdown({
  closeApp: () => app.close(),
  disconnectPrisma: disconnectPrismaClient,
  logger: app.log
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

await app.listen({ port, host: "0.0.0.0" });

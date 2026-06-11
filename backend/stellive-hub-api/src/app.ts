import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyRequest } from "fastify";
import { loadEnv } from "./config/env.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import registerChzzkAuthRoutes, { type ChzzkAuthRouteOptions } from "./routes/chzzkAuthRoutes.js";
import { type InternalRouteDependencies, registerInternalRoutes } from "./routes/internalRoutes.js";
import { type AppRouteDependencies, registerRoutes } from "./routes/routes.js";

type EnvOverrides = Record<string, string | boolean | number | undefined>;

export interface BuildAppOptions {
  env?: EnvOverrides;
  useProcessEnv?: boolean;
  chzzkAuthRoutes?: {
    dependencies?: Partial<Omit<ChzzkAuthRouteOptions, "env">>;
  };
  internalRoutes?: {
    dependencies?: Partial<InternalRouteDependencies>;
  };
  appRoutes?: {
    dependencies?: AppRouteDependencies;
  };
}

const testDatabaseUrl = "postgresql://stellive:stellive@localhost:5432/stellive_hub_test";
const publicCorsOptions = { origin: "*" };
const privilegedCorsOptions = { origin: false };

function isPrivilegedRoutePath(url: string): boolean {
  return url === "/admin" || url.startsWith("/admin?") || url.startsWith("/admin/") || url.startsWith("/v1/internal/");
}

function corsDelegator(request: FastifyRequest, callback: (error: Error | null, options?: { origin: string | boolean }) => void) {
  callback(null, isPrivilegedRoutePath(request.url) ? privilegedCorsOptions : publicCorsOptions);
}

function resolveEnvInput(options: BuildAppOptions): NodeJS.ProcessEnv | Record<string, string | boolean | number | undefined> {
  const envInput = options.useProcessEnv === false ? options.env ?? {} : { ...process.env, ...options.env };
  const nodeEnv = typeof envInput.NODE_ENV === "string" ? envInput.NODE_ENV : process.env.NODE_ENV;

  if (!envInput.DATABASE_URL && nodeEnv === "test") {
    return { ...envInput, DATABASE_URL: testDatabaseUrl };
  }

  return envInput;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = loadEnv(resolveEnvInput(options));
  const app = Fastify({ logger: true });
  await app.register(cors, { delegator: corsDelegator });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Stellive Notification Hub API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await registerRoutes(app, { dependencies: options.appRoutes?.dependencies });
  await registerChzzkAuthRoutes(app, {
    env,
    ...options.chzzkAuthRoutes?.dependencies
  });
  await registerInternalRoutes(app, { env, dependencies: options.internalRoutes?.dependencies });
  await registerAdminRoutes(app, { env });
  return app;
}

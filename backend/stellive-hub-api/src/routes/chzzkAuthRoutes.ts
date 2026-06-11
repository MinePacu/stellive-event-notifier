import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AdapterHealth } from "../admin/adminTypes.js";
import type { ChzzkTokenResponse } from "../adapters/chzzk/chzzkAuthClient.js";
import { ChzzkAuthClient } from "../adapters/chzzk/chzzkAuthClient.js";
import { createChzzkOAuthState, verifyChzzkOAuthState } from "../adapters/chzzk/chzzkOAuthState.js";
import type { AppEnv } from "../config/env.js";
import { PlatformApiStateRepository } from "../repositories/platformApiStateRepository.js";

export interface ChzzkAuthRouteAuthClient {
  buildAuthorizeUrl(input: { state: string }): string;
  exchangeCodeForToken(input: { code: string; state: string }): Promise<ChzzkTokenResponse>;
}

export interface ChzzkAuthRouteStateRepository {
  upsertState(source: string, key: string, value: Prisma.InputJsonValue, status: string): Promise<unknown>;
  upsertAdapterHealth(source: "chzzk", health: AdapterHealth): Promise<unknown>;
}

export interface ChzzkAuthRouteOptions {
  env: AppEnv;
  authClient?: ChzzkAuthRouteAuthClient;
  stateRepository?: ChzzkAuthRouteStateRepository;
  now?: () => Date;
}

function createDefaultAuthClient(env: AppEnv): ChzzkAuthClient | undefined {
  if (!env.CHZZK_CLIENT_ID || !env.CHZZK_CLIENT_SECRET || !env.CHZZK_REDIRECT_URI) return undefined;
  return new ChzzkAuthClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
    redirectUri: env.CHZZK_REDIRECT_URI
  });
}

function isConfigured(options: ChzzkAuthRouteOptions): boolean {
  return options.env.CHZZK_OAUTH_ENABLED && options.env.CHZZK_OAUTH_CONFIGURED && Boolean(options.authClient);
}

async function storeTokenMetadata(
  repository: ChzzkAuthRouteStateRepository,
  token: ChzzkTokenResponse,
  now: Date
): Promise<void> {
  const expiresAt = new Date(now.getTime() + token.expiresIn * 1000).toISOString();

  await repository.upsertState("chzzk", "oauth.accessToken", { token: token.accessToken }, "enabled");
  await repository.upsertState("chzzk", "oauth.refreshToken", { token: token.refreshToken }, "enabled");
  await repository.upsertState("chzzk", "oauth.expiresAt", { value: expiresAt }, "enabled");
  await repository.upsertState("chzzk", "oauth.scope", { value: token.scope ?? null }, "enabled");
  await repository.upsertState("chzzk", "oauth.tokenType", { value: token.tokenType }, "enabled");
  await repository.upsertState("chzzk", "oauth.lastRefreshedAt", { value: now.toISOString() }, "enabled");
  await repository.upsertAdapterHealth("chzzk", {
    source: "chzzk",
    status: "verify_required",
    reason: "chzzk_allowed_api_not_confirmed",
    lastCheckedAt: now.toISOString()
  });
}

export async function registerChzzkAuthRoutes(app: FastifyInstance, input: ChzzkAuthRouteOptions): Promise<void> {
  const options = {
    ...input,
    authClient: input.authClient ?? createDefaultAuthClient(input.env),
    stateRepository: input.stateRepository ?? new PlatformApiStateRepository(),
    now: input.now ?? (() => new Date())
  };

  app.get("/v1/auth/chzzk/start", async (_request, reply) => {
    if (!isConfigured(options)) {
      return reply.code(503).send({ error: "chzzk_oauth_not_configured" });
    }

    const state = createChzzkOAuthState(options.env.CHZZK_AUTH_STATE_SECRET!, options.now());
    return reply.redirect(options.authClient!.buildAuthorizeUrl({ state }));
  });

  app.get<{ Querystring: { code?: string; state?: string } }>("/v1/auth/chzzk/callback", async (request, reply) => {
    if (!isConfigured(options)) {
      return reply.code(503).send({ error: "chzzk_oauth_not_configured" });
    }
    if (!request.query.code) {
      return reply.code(400).send({ error: "chzzk_oauth_code_missing" });
    }
    if (!request.query.state) {
      return reply.code(400).send({ error: "invalid_oauth_state" });
    }

    const state = verifyChzzkOAuthState(options.env.CHZZK_AUTH_STATE_SECRET!, request.query.state, options.now());
    if (!state.ok) {
      return reply.code(400).send({ error: "invalid_oauth_state" });
    }

    const token = await options.authClient!.exchangeCodeForToken({
      code: request.query.code,
      state: request.query.state
    });
    await storeTokenMetadata(options.stateRepository, token, options.now());

    if (options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.redirect("/admin?chzzk=connected");
    }

    return reply.send({ connected: true, source: "chzzk" });
  });
}

export default registerChzzkAuthRoutes;

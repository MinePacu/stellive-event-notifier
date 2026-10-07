import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticateAdminRequest, isSecureRequest, shouldEnableAdminConsole } from "../admin/adminAuth.js";
import { AuthFailureLimiter, sendAuthRateLimited } from "../admin/authFailureLimiter.js";
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
  upsertStateTransaction?(
    entries: Array<{ source: string; key: string; value: Prisma.InputJsonValue; status: string }>,
    health?: { source: "chzzk"; health: AdapterHealth }
  ): Promise<void>;
}

export interface ChzzkAuthRouteOptions {
  env: AppEnv;
  authClient?: ChzzkAuthRouteAuthClient;
  stateRepository?: ChzzkAuthRouteStateRepository;
  now?: () => Date;
  authFailureLimiter?: AuthFailureLimiter;
}

const oauthNonceCookieName = "chzzk_oauth_nonce";
const oauthNonceCookiePath = "/v1/auth/chzzk";
const oauthNonceMaxAgeSeconds = 10 * 60;

function serializeOAuthNonceCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    `${oauthNonceCookieName}=${value}`,
    `Path=${oauthNonceCookiePath}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    // Lax (not Strict): the callback arrives via a cross-site top-level redirect from CHZZK.
    "SameSite=Lax"
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function readOAuthNonceCookie(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === oauthNonceCookieName) return valueParts.join("=") || undefined;
  }
  return undefined;
}

function nonceMatches(expected: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function createDefaultAuthClient(env: AppEnv): ChzzkAuthClient | undefined {
  if (!env.CHZZK_CLIENT_ID || !env.CHZZK_CLIENT_SECRET || !env.CHZZK_REDIRECT_URI) return undefined;
  return new ChzzkAuthClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
    redirectUri: env.CHZZK_REDIRECT_URI,
    scopes: env.CHZZK_OAUTH_SCOPES
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

  const entries = [
    { source: "chzzk", key: "oauth.accessToken", value: { token: token.accessToken }, status: "enabled" },
    { source: "chzzk", key: "oauth.refreshToken", value: { token: token.refreshToken }, status: "enabled" },
    { source: "chzzk", key: "oauth.expiresAt", value: { value: expiresAt }, status: "enabled" },
    { source: "chzzk", key: "oauth.scope", value: { value: token.scope ?? null }, status: "enabled" },
    { source: "chzzk", key: "oauth.tokenType", value: { value: token.tokenType }, status: "enabled" },
    { source: "chzzk", key: "oauth.lastRefreshedAt", value: { value: now.toISOString() }, status: "enabled" }
  ];
  const health: AdapterHealth = {
    source: "chzzk",
    status: "verify_required",
    reason: "chzzk_allowed_api_not_confirmed",
    lastCheckedAt: now.toISOString()
  };

  // Persist all OAuth token metadata atomically so a partial failure cannot leave, e.g., an
  // access token without its matching expiry. Repositories without transaction support fall
  // back to sequential writes (in-memory test doubles only).
  if (repository.upsertStateTransaction) {
    await repository.upsertStateTransaction(entries, { source: "chzzk", health });
    return;
  }
  for (const entry of entries) {
    await repository.upsertState(entry.source, entry.key, entry.value, entry.status);
  }
  await repository.upsertAdapterHealth("chzzk", health);
}

export async function registerChzzkAuthRoutes(app: FastifyInstance, input: ChzzkAuthRouteOptions): Promise<void> {
  const options = {
    ...input,
    authClient: input.authClient ?? createDefaultAuthClient(input.env),
    stateRepository: input.stateRepository ?? new PlatformApiStateRepository(),
    now: input.now ?? (() => new Date()),
    authFailureLimiter: input.authFailureLimiter ?? new AuthFailureLimiter()
  };

  app.get("/v1/auth/chzzk/start", async (request, reply) => {
    if (!isConfigured(options)) {
      return reply.code(503).send({ error: "chzzk_oauth_not_configured" });
    }
    // Only an authenticated admin may mint a state; otherwise anyone could attach their own
    // CHZZK account to this server (login CSRF).
    if (!options.env.ADMIN_CONSOLE_ENABLED) return reply.callNotFound();
    if (!shouldEnableAdminConsole(options.env)) return reply.code(503).send({ error: "admin_console_token_missing" });
    const retryAfterSeconds = options.authFailureLimiter.retryAfterSeconds(request.ip);
    if (retryAfterSeconds !== undefined) return sendAuthRateLimited(reply, retryAfterSeconds);
    const auth = authenticateAdminRequest(request.headers, options.env);
    options.authFailureLimiter.recordResult(request.ip, auth);
    if (!auth.ok) return reply.code(401).send({ error: auth.reason });

    const { state, nonce } = createChzzkOAuthState(options.env.CHZZK_AUTH_STATE_SECRET!, options.now());
    reply.header(
      "Set-Cookie",
      serializeOAuthNonceCookie(nonce, oauthNonceMaxAgeSeconds, isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE))
    );
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

    // The state is single-use per browser: clear the nonce cookie on every response from here on.
    reply.header("Set-Cookie", serializeOAuthNonceCookie("", 0, isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE)));

    const state = verifyChzzkOAuthState(options.env.CHZZK_AUTH_STATE_SECRET!, request.query.state, options.now());
    if (!state.ok || !nonceMatches(state.nonce, readOAuthNonceCookie(request))) {
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

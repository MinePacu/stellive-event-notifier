import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import {
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  shouldEnableAdminConsole
} from "../admin/adminAuth.js";
import type { AppEnv } from "../config/env.js";

export interface AdminRoutesOptions {
  env: AppEnv;
}

const privilegedRouteOptions: RouteShorthandOptions = {
  config: {
    cors: false
  } as unknown as RouteShorthandOptions["config"]
};

const adminConsoleContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'"
].join("; ");

const adminConsolePathPrefix = "/admin/";
const immutableAssetCacheControl = "public, max-age=31536000, immutable";

const adminConsoleMimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

export async function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions) {
  const distDir = resolveAdminConsoleDistDir(options.env.ADMIN_CONSOLE_DIST_DIR);

  app.get("/v1/admin/session", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    const unavailable = sendAdminConsoleUnavailable(options.env, reply);
    if (unavailable) return unavailable;

    reply.headers(adminConsoleNoStoreHeaders());
    const authorizationHeader = readHeader(request.headers.authorization, ",");
    const auth = authorizationHeader
      ? authenticateBearerToken(authorizationHeader, options.env.ADMIN_CONSOLE_TOKEN)
      : authenticateAdminSessionCookie(readHeader(request.headers.cookie, "; "), options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) {
      return reply.code(401).send({ error: auth.reason });
    }

    return reply.send({ authenticated: true });
  });

  app.post("/v1/admin/session", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    const unavailable = sendAdminConsoleUnavailable(options.env, reply);
    if (unavailable) return unavailable;

    reply.headers(adminConsoleNoStoreHeaders());
    const token = readSessionToken(request.body);
    const auth = authenticateBearerToken(token ? `Bearer ${token}` : undefined, options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) {
      return reply.code(401).send({ error: "invalid_admin_token" });
    }

    const cookie = createAdminSessionCookie({
      adminToken: options.env.ADMIN_CONSOLE_TOKEN,
      secure: isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE)
    });
    if (!cookie) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    return reply.code(204).header("Set-Cookie", cookie.header).send();
  });

  app.delete("/v1/admin/session", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    const unavailable = sendAdminConsoleUnavailable(options.env, reply);
    if (unavailable) return unavailable;

    const secure = isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE);
    return reply
      .code(204)
      .headers(adminConsoleNoStoreHeaders())
      .header("Set-Cookie", clearAdminSessionCookie(secure))
      .send();
  });

  const serveAdminConsole = async (request: FastifyRequest, reply: FastifyReply) => {
    const unavailable = sendAdminConsoleUnavailable(options.env, reply);
    if (unavailable) return unavailable;

    const indexPath = path.join(distDir, "index.html");
    if (!(await isRegularFile(indexPath))) {
      return reply.code(503).headers(adminConsoleNoStoreHeaders()).send({ error: "admin_console_not_built" });
    }

    const segments = readAdminConsolePathSegments(request.url);
    if (!segments) {
      return reply.callNotFound();
    }

    const isAssetPath = segments[0] === "assets";
    const filePath = segments.length > 0 ? await resolveDistFile(distDir, segments) : undefined;
    if (!filePath && isAssetPath) {
      return reply.callNotFound();
    }

    const servedPath = filePath ?? indexPath;
    const body = await readFile(servedPath);
    applyAdminConsoleSecurityHeaders(reply);
    if (filePath && isAssetPath) {
      reply.header("Cache-Control", immutableAssetCacheControl);
    } else {
      reply.headers(adminConsoleNoStoreHeaders());
    }

    return reply.type(adminConsoleMimeTypes[path.extname(servedPath).toLowerCase()] ?? "application/octet-stream").send(body);
  };

  app.get("/admin", privilegedRouteOptions, serveAdminConsole);
  app.get("/admin/*", privilegedRouteOptions, serveAdminConsole);
}

export function resolveAdminConsoleDistDir(configuredDir: string | undefined): string {
  return path.resolve(process.cwd(), configuredDir ?? "../../admin/stellive-hub-admin/dist");
}

function sendAdminConsoleUnavailable(env: AppEnv, reply: FastifyReply): FastifyReply | undefined {
  if (!env.ADMIN_CONSOLE_ENABLED) {
    reply.callNotFound();
    return reply;
  }

  if (!shouldEnableAdminConsole(env)) {
    return reply.code(503).send({ error: "admin_console_token_missing" });
  }

  return undefined;
}

/**
 * Returns decoded path segments below /admin/, or undefined when the path is unsafe
 * (undecodable, dot segments or dotfiles, embedded separators, or null bytes).
 */
function readAdminConsolePathSegments(url: string): string[] | undefined {
  const pathname = url.split("?", 1)[0];
  if (!pathname.startsWith(adminConsolePathPrefix)) return [];

  const segments: string[] = [];
  for (const rawSegment of pathname.slice(adminConsolePathPrefix.length).split("/")) {
    if (rawSegment === "") continue;

    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return undefined;
    }

    if (segment.startsWith(".") || segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
      return undefined;
    }
    segments.push(segment);
  }

  return segments;
}

async function resolveDistFile(distDir: string, segments: string[]): Promise<string | undefined> {
  const candidate = path.resolve(distDir, ...segments);
  if (!isPathInside(distDir, candidate)) return undefined;

  try {
    const [realDistDir, realCandidate] = await Promise.all([realpath(distDir), realpath(candidate)]);
    if (!isPathInside(realDistDir, realCandidate)) return undefined;
    return (await isRegularFile(realCandidate)) ? realCandidate : undefined;
  } catch {
    return undefined;
  }
}

function isPathInside(rootDir: string, candidate: string): boolean {
  return candidate.startsWith(rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`);
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function readHeader(value: string | string[] | undefined, separator: string): string | undefined {
  if (Array.isArray(value)) {
    return value.join(separator);
  }

  return value;
}

function readSessionToken(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;

  const token = (body as { token?: unknown }).token;
  return typeof token === "string" ? token.trim() || undefined : undefined;
}

function applyAdminConsoleSecurityHeaders(reply: FastifyReply) {
  reply.header("X-Frame-Options", "DENY");
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Content-Security-Policy", adminConsoleContentSecurityPolicy);
}

function adminConsoleNoStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache"
  };
}

function isSecureRequest(request: FastifyRequest, forceSecureCookie: boolean): boolean {
  return forceSecureCookie || request.protocol === "https";
}

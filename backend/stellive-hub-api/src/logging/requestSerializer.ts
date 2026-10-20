export interface LoggedRequestLike {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  host?: string;
  ip?: string;
  socket?: { remotePort?: number };
}

// Mirrors Fastify's default `req` log serializer, but drops the query string
// because it can carry deviceId, hub.verify_token and OAuth code/state values.
export function serializeRequestForLog(req: LoggedRequestLike) {
  const url = req.url;
  const queryIndex = url?.indexOf("?") ?? -1;
  const acceptVersion = req.headers?.["accept-version"];
  return {
    method: req.method,
    url: url !== undefined && queryIndex >= 0 ? `${url.slice(0, queryIndex)}?[redacted]` : url,
    version: Array.isArray(acceptVersion) ? acceptVersion.join(", ") : acceptVersion,
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket ? req.socket.remotePort : undefined
  };
}

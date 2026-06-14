import z from "zod";

const authorizeUrl = "https://chzzk.naver.com/account-interlock";
const tokenUrl = "https://openapi.chzzk.naver.com/auth/v1/token";

const tokenResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    tokenType: z.literal("Bearer"),
    expiresIn: z.union([z.string(), z.number()]).transform((value) => Number(value)),
    scope: z.string().optional()
  })
  .refine((value) => Number.isFinite(value.expiresIn) && value.expiresIn > 0, {
    message: "expiresIn must be a positive number",
    path: ["expiresIn"]
  });
const tokenEnvelopeResponseSchema = z.object({
  content: tokenResponseSchema
});

export type ChzzkTokenResponse = z.infer<typeof tokenResponseSchema>;

export interface ChzzkAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string;
}

export interface ChzzkAuthClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class ChzzkTokenResponseError extends Error {
  constructor() {
    super("chzzk_token_response_invalid");
    this.name = "ChzzkTokenResponseError";
  }
}

export class ChzzkAuthClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ChzzkAuthConfig,
    options: ChzzkAuthClientOptions = {}
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  buildAuthorizeUrl({ state }: { state: string }): string {
    const url = new URL(authorizeUrl);
    url.searchParams.set("clientId", this.config.clientId);
    url.searchParams.set("redirectUri", this.config.redirectUri);
    url.searchParams.set("state", state);
    if (this.config.scopes) url.searchParams.set("scope", this.config.scopes);
    return url.toString();
  }

  exchangeCodeForToken({ code, state }: { code: string; state: string }): Promise<ChzzkTokenResponse> {
    return this.requestToken({
      grantType: "authorization_code",
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      code,
      state,
      redirectUri: this.config.redirectUri
    });
  }

  refreshAccessToken({ refreshToken }: { refreshToken: string }): Promise<ChzzkTokenResponse> {
    return this.requestToken({
      grantType: "refresh_token",
      refreshToken,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret
    });
  }

  private async requestToken(body: Record<string, string>): Promise<ChzzkTokenResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json();
      const parsed = tokenResponseSchema.safeParse(payload);
      if (!parsed.success) {
        const envelopeParsed = tokenEnvelopeResponseSchema.safeParse(payload);
        if (envelopeParsed.success) return envelopeParsed.data.content;
      }
      if (!parsed.success) throw new ChzzkTokenResponseError();
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

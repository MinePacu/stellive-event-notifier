export interface YoutubeWebSubSubscriptionTarget {
  targetId: string;
  channelId: string;
  topicUrl: string;
}

interface YoutubeWebSubSubscriptionWritePort {
  upsertSubscription(input: {
    source: string;
    targetId: string;
    callbackUrl: string;
    topicUrl: string;
    status: string;
    leaseExpiresAt?: Date | null;
    lastVerifiedAt?: Date | null;
    lastError?: string | null;
  }): Promise<void>;
}

interface YoutubeWebSubSubscriptionServiceOptions {
  callbackUrl: string;
  verifyToken: string;
  targets: YoutubeWebSubSubscriptionTarget[];
  subscriptions: YoutubeWebSubSubscriptionWritePort;
  fetch?: typeof fetch;
  now?: () => Date;
}

export class YoutubeWebSubSubscriptionService {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: YoutubeWebSubSubscriptionServiceOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async renewSubscriptions(): Promise<{
    status: "ok" | "partial_failure";
    renewed: number;
    failed: number;
    skipped: number;
  }> {
    let renewed = 0;
    let failed = 0;
    let skipped = 0;

    for (const target of this.options.targets) {
      if (!target.channelId || !target.topicUrl) {
        skipped += 1;
        continue;
      }

      const body = new URLSearchParams({
        "hub.callback": this.options.callbackUrl,
        "hub.mode": "subscribe",
        "hub.topic": target.topicUrl,
        "hub.verify": "async",
        "hub.verify_token": this.options.verifyToken,
      });

      try {
        const response = await this.fetchImpl("https://pubsubhubbub.appspot.com/subscribe", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
        });

        if (!response.ok) {
          failed += 1;
          await this.options.subscriptions.upsertSubscription({
            source: "youtube",
            targetId: target.targetId,
            callbackUrl: this.options.callbackUrl,
            topicUrl: target.topicUrl,
            status: "error",
            lastError: `youtube_websub_subscription_failed:${response.status}`,
          });
          continue;
        }

        renewed += 1;
        await this.options.subscriptions.upsertSubscription({
          source: "youtube",
          targetId: target.targetId,
          callbackUrl: this.options.callbackUrl,
          topicUrl: target.topicUrl,
          status: "pending_verification",
          lastVerifiedAt: this.options.now?.() ?? new Date(),
          lastError: null,
        });
      } catch {
        failed += 1;
        await this.options.subscriptions.upsertSubscription({
          source: "youtube",
          targetId: target.targetId,
          callbackUrl: this.options.callbackUrl,
          topicUrl: target.topicUrl,
          status: "error",
          lastError: "youtube_websub_subscription_failed:network_error",
        });
      }
    }

    return {
      status: failed > 0 ? "partial_failure" : "ok",
      renewed,
      failed,
      skipped,
    };
  }
}

export default YoutubeWebSubSubscriptionService;

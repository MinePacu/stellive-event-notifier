# Privacy And Terms

This project is unofficial and not affiliated with or endorsed by Stellive, CHZZK, YouTube, X, Naver, Samsung, or Apple.

## Data Minimization

Store device tokens and preferences only as needed for notification delivery. Raw platform payloads should be minimized and retention-limited.

User-visible notification history is stored on the user's device by default. The server should not keep long-term per-user notification history for the MVP. Server-side delivery attempts are technical records for retries, diagnostics, abuse/rate-limit controls, and should be retention-limited.

## Secrets

Do not commit secrets. Use `.env.example` for variable names only.

## Profile Images

Do not bundle official logos, profile images, fan art, captured images, or copied CDN assets. Runtime API image URLs can be shown only when allowed and must include fallback behavior.

## Rights Requests

If a rights holder requests removal, switch affected avatars to placeholders, delete cached image data, remove image URL references where required, and document the action. Admin-only avatar placeholder endpoints/scripts should support this flow.

## Platform Terms

Do not scrape private posts, use login cookies, bypass access controls, or exceed rate limits. Naver Cafe automatic collection is deferred for the MVP. If it returns later, it is limited to public Search API results or another clearly allowed official path.

## Realtime Stream

Foreground realtime streams must be authenticated and should include only normalized event fields required for UI refresh. Do not stream unnecessary raw payloads or personal data.

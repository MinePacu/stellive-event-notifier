const maxImageUrlLength = 2048;
const credentialQueryKeyParts = ["token", "key", "secret", "signature", "auth", "credential"];

export function normalizeSafeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;

    for (const key of parsed.searchParams.keys()) {
      const normalizedKey = key.toLowerCase();
      if (credentialQueryKeyParts.some((part) => normalizedKey.includes(part))) {
        return undefined;
      }
    }

    const normalizedUrl = parsed.toString();
    return normalizedUrl.length <= maxImageUrlLength ? normalizedUrl : undefined;
  } catch {
    return undefined;
  }
}

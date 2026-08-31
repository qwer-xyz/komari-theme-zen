import type { PublicInfo } from "@/contexts/PublicInfoContext";
import { syncThemeAppearanceFromPublicSettings } from "@/lib/themeAppearance";

let cachedPublicInfo: PublicInfo | null | undefined;
let inflight: Promise<PublicInfo | null> | null = null;
let inflightController: AbortController | null = null;
let requestVersion = 0;
const PUBLIC_INFO_TIMEOUT_MS = 10_000;

export function prefetchPublicInfo(force = false): Promise<PublicInfo | null> {
  if (force) {
    requestVersion += 1;
    inflightController?.abort();
    cachedPublicInfo = undefined;
    inflight = null;
    inflightController = null;
  }

  if (cachedPublicInfo !== undefined) {
    return Promise.resolve(cachedPublicInfo);
  }

  if (inflight) return inflight;

  const version = ++requestVersion;
  const controller = new AbortController();
  inflightController = controller;
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    PUBLIC_INFO_TIMEOUT_MS,
  );

  inflight = fetch("/api/public", { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((resp) => {
      if (!resp || typeof resp !== "object" || Array.isArray(resp)) {
        throw new Error("Invalid public information response");
      }
      const data = (resp as { data?: unknown }).data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid public information response");
      }
      if (version === requestVersion) {
        cachedPublicInfo = data as PublicInfo;
        syncThemeAppearanceFromPublicSettings(
          (data as PublicInfo).theme_settings,
        );
      }
      return data as PublicInfo;
    })
    .catch((error: unknown) => {
      // A transient bootstrap failure must not become a permanent cached result.
      if (version === requestVersion) cachedPublicInfo = undefined;
      throw error instanceof Error
        ? error
        : new Error("Public information request failed");
    })
    .finally(() => {
      window.clearTimeout(timeout);
      if (version === requestVersion) {
        inflight = null;
        inflightController = null;
      }
    });

  return inflight;
}

export function getPrefetchedPublicInfo(): PublicInfo | null | undefined {
  return cachedPublicInfo;
}

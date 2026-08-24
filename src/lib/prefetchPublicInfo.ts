import type { PublicInfo } from "@/contexts/PublicInfoContext";
import { syncThemeAppearanceFromPublicSettings } from "@/lib/themeAppearance";

interface PublicInfoResponse {
  data: PublicInfo;
  message: string;
  status: string;
}

let cachedPublicInfo: PublicInfo | null | undefined;
let inflight: Promise<PublicInfo | null> | null = null;

export function prefetchPublicInfo(force = false): Promise<PublicInfo | null> {
  if (force) {
    cachedPublicInfo = undefined;
    inflight = null;
  }

  if (cachedPublicInfo !== undefined) {
    return Promise.resolve(cachedPublicInfo);
  }

  if (inflight) return inflight;

  inflight = fetch("/api/public")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<PublicInfoResponse>;
    })
    .then((resp) => {
      const data = resp.data ?? null;
      cachedPublicInfo = data;
      if (data?.theme_settings && typeof data.theme_settings === "object") {
        syncThemeAppearanceFromPublicSettings(
          data.theme_settings as Record<string, unknown>,
        );
      }
      return data;
    })
    .catch(() => {
      cachedPublicInfo = null;
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getPrefetchedPublicInfo(): PublicInfo | null | undefined {
  return cachedPublicInfo;
}

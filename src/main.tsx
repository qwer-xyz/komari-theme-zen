import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { LiveDataProvider } from "./contexts/LiveDataContext.tsx";
import { NodeListProvider } from "./contexts/NodeListContext.tsx";
import { PublicInfoProvider } from "./contexts/PublicInfoContext.tsx";
import { RPC2Provider } from "./contexts/RPC2Context.tsx";
import { prefetchPublicInfo } from "@/lib/prefetchPublicInfo";
import { bootstrapThemeAppearance } from "@/lib/themeAppearance";
import { clearQueryCache } from "@/lib/queryCache";
import "./index.css";

function consumeTemporaryAccessKey(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("temp_key")) return;
  const tempKey = params.get("temp_key") ?? undefined;

  // RFC 6265 cookie-octet: keep the backend's token bytes unchanged while
  // rejecting delimiters/control characters that could inject attributes.
  const isCookieSafe =
    tempKey !== undefined &&
    /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(tempKey);
  if (isCookieSafe) {
    clearQueryCache();
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `temp_key=${tempKey}; Path=/; Max-Age=${60 * 60 * 24 * 365 * 100}; SameSite=Lax${secure}`;
  } else {
    console.warn("Ignored an invalid temporary access key.");
  }

  params.delete("temp_key");
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

// Credentials must be available before public-info prefetch and RPC auto-connect.
consumeTemporaryAccessKey();
bootstrapThemeAppearance();
void prefetchPublicInfo().catch(() => undefined);

function Bootstrap() {
  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}
    >
      <RPC2Provider>
        <PublicInfoProvider>
          <LiveDataProvider>
            <NodeListProvider>
              <App />
            </NodeListProvider>
          </LiveDataProvider>
        </PublicInfoProvider>
      </RPC2Provider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { LiveDataProvider } from "./contexts/LiveDataContext.tsx";
import { NodeListProvider } from "./contexts/NodeListContext.tsx";
import { PublicInfoProvider } from "./contexts/PublicInfoContext.tsx";
import { RPC2Provider } from "./contexts/RPC2Context.tsx";
import { prefetchPublicInfo } from "@/lib/prefetchPublicInfo";
import { bootstrapThemeAppearance } from "@/lib/themeAppearance";
import "./index.css";

bootstrapThemeAppearance();
void prefetchPublicInfo();

function Bootstrap() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tempKey = params.get("temp_key");

    if (!tempKey) return;

    document.cookie = `temp_key=${tempKey}; path=/; max-age=${60 * 60 * 24 * 365 * 100}`;
    params.delete("temp_key");
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }, []);

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

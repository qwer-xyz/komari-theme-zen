import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { prefetchPublicInfo } from "@/lib/prefetchPublicInfo";
import { syncThemeAppearanceFromPublicSettings } from "@/lib/themeAppearance";

export interface PublicInfo {
  allow_cors: boolean;
  custom_body: string;
  custom_head: string;
  description: string;
  disable_password_login: boolean;
  oauth_provider: string;
  oauth_enable: boolean;
  ping_record_preserve_time: number;
  record_enabled: boolean;
  record_preserve_time: number;
  sitename: string;
  private_site: boolean;
  theme: string;
  theme_settings: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface PublicInfoContextType {
  publicInfo: PublicInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const PublicInfoContext = createContext<PublicInfoContextType | undefined>(
  undefined,
);

export const PublicInfoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((force: boolean) => {
    setError(null);
    setIsLoading(true);

    return prefetchPublicInfo(force)
      .then((data) => {
        if (!data) {
          setError("获取公开信息失败");
          setPublicInfo(null);
          return;
        }
        setPublicInfo(data);
        if (data?.theme_settings && typeof data.theme_settings === "object") {
          syncThemeAppearanceFromPublicSettings(data.theme_settings);
        }
      })
      .catch((err: Error) => {
        setError(err.message || "获取公开信息失败");
        setPublicInfo(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const value = useMemo(
    () => ({ publicInfo, isLoading, error, refresh }),
    [publicInfo, isLoading, error, refresh],
  );

  return (
    <PublicInfoContext.Provider value={value}>
      {children}
    </PublicInfoContext.Provider>
  );
};

export const usePublicInfo = () => {
  const context = useContext(PublicInfoContext);
  if (!context) {
    throw new Error("usePublicInfo 必须在 PublicInfoProvider 内使用");
  }
  return context;
};

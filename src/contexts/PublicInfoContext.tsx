import React, { createContext, useContext, useEffect, useState } from "react";
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

  const refresh = () => {
    setError(null);
    setIsLoading(true);

    prefetchPublicInfo(true)
      .then((data) => {
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
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <PublicInfoContext.Provider
      value={{ publicInfo, isLoading, error, refresh }}
    >
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

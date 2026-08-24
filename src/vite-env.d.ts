/// <reference types="vite/client" />

declare const __THEME_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_TARGET?: string;
  readonly VITE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

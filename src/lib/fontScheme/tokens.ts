export type FontPresetId =
  | "Default"
  | "MapleMonoCN"
  | "Yomeng"
  | "LXGWWenKai"
  | "WenYuanRounded"
  | "Custom";

export type FontPreset = {
  id: FontPresetId;
  sans: string;
  mono: string;
  cssUrls: readonly string[];
  preconnect?: readonly string[];
};

export type FontSchemeSettings = {
  presetId: FontPresetId;
  customFamily: string;
  customCssUrl: string;
};

export type ResolvedFontVars = {
  "--font-sans": string;
  "--font-mono": string;
};

export const FONT_CSS_VAR_KEYS = {
  sans: "--font-sans",
  mono: "--font-mono",
} as const;

export const DEFAULT_FONT_PRESET_ID: FontPresetId = "Default";

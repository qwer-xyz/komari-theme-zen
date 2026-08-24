import type { FontPreset, FontPresetId } from "./tokens";

export const FONT_PRESETS: Record<FontPresetId, FontPreset> = {
  Default: {
    id: "Default",
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    cssUrls: [
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;700&display=swap",
    ],
    preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
  },
  MapleMonoCN: {
    id: "MapleMonoCN",
    sans: '"Maple Mono NF CN", ui-monospace, monospace',
    mono: '"Maple Mono NF CN", ui-monospace, monospace',
    cssUrls: ["https://fontsapi.zeoseven.com/442/main/result.css"],
    preconnect: ["https://fontsapi.zeoseven.com"],
  },
  Yomeng: {
    id: "Yomeng",
    sans: '"Yomeng Script", ui-sans-serif, system-ui, sans-serif',
    mono: '"Yomeng Script", ui-monospace, monospace',
    cssUrls: ["https://fontsapi.zeoseven.com/813/main/result.css"],
    preconnect: ["https://fontsapi.zeoseven.com"],
  },
  LXGWWenKai: {
    id: "LXGWWenKai",
    sans: '"LXGW WenKai", ui-sans-serif, system-ui, sans-serif',
    mono: '"LXGW WenKai", ui-monospace, monospace',
    cssUrls: ["https://fontsapi.zeoseven.com/292/main/result.css"],
    preconnect: ["https://fontsapi.zeoseven.com"],
  },
  WenYuanRounded: {
    id: "WenYuanRounded",
    sans: '"WenYuan Rounded SC VF", ui-sans-serif, system-ui, sans-serif',
    mono: '"WenYuan Rounded SC VF", ui-monospace, monospace',
    cssUrls: ["https://fontsapi.zeoseven.com/414/main/result.css"],
    preconnect: ["https://fontsapi.zeoseven.com"],
  },
  Custom: {
    id: "Custom",
    sans: "",
    mono: "",
    cssUrls: [],
  },
};

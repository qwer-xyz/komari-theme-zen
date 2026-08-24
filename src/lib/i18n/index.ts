import type { Lang, LangPreference, Messages } from "./types";
import { en } from "./locales/en";
import { zh } from "./locales/zh";
import { zhTW } from "./locales/zh-TW";
import { ja } from "./locales/ja";
import { id } from "./locales/id";

export type { Lang, LangPreference, Messages } from "./types";

export const translations: Record<Lang, Messages> = {
  en,
  zh,
  "zh-TW": zhTW,
  ja,
  id,
};

export function formatMsg(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}

export const LANG_MENU_OPTIONS: {
  value: Lang;
  label: Record<Lang, string>;
}[] = [
  {
    value: "zh",
    label: {
      en: "简体中文",
      zh: "简体中文",
      "zh-TW": "简体中文",
      ja: "简体中文",
      id: "简体中文",
    },
  },
  {
    value: "zh-TW",
    label: {
      en: "繁體中文",
      zh: "繁體中文",
      "zh-TW": "繁體中文",
      ja: "繁體中文",
      id: "繁體中文",
    },
  },
  {
    value: "ja",
    label: {
      en: "日本語",
      zh: "日本語",
      "zh-TW": "日本語",
      ja: "日本語",
      id: "日本語",
    },
  },
  {
    value: "id",
    label: {
      en: "Bahasa Indonesia",
      zh: "Bahasa Indonesia",
      "zh-TW": "Bahasa Indonesia",
      ja: "Bahasa Indonesia",
      id: "Bahasa Indonesia",
    },
  },
  {
    value: "en",
    label: {
      en: "English",
      zh: "English",
      "zh-TW": "English",
      ja: "English",
      id: "English",
    },
  },
];

/** Label for the language selector trigger — always reflects the active UI language. */
export function getLangMenuLabel(displayLang: Lang): string {
  const opt = LANG_MENU_OPTIONS.find((o) => o.value === displayLang);
  return opt?.label[displayLang] ?? displayLang;
}

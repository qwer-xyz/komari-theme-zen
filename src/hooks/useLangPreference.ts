import { useEffect, useState } from "react";
import type { Lang, LangPreference } from "@/lib/i18n";

export type { LangPreference } from "@/lib/i18n";

const STORAGE_KEY = "komari-zen-lang";

const MANUAL_LANGS: Lang[] = ["en", "zh", "zh-TW", "ja", "id"];

function readStored(): LangPreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "auto") return "auto";
    if (MANUAL_LANGS.includes(v as Lang)) return v as Lang;
  } catch {
    /* ignore */
  }
  return "auto";
}

function detectSystemLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const raw of langs) {
    const tag = raw.toLowerCase();
    if (
      tag.startsWith("zh-tw") ||
      tag.startsWith("zh-hk") ||
      tag.startsWith("zh-hant") ||
      tag.includes("-tw") ||
      tag.includes("-hk")
    ) {
      return "zh-TW";
    }
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("id")) return "id";
  }
  return "en";
}

export function useLangPreference() {
  const [preference, setPreferenceState] = useState<LangPreference>(readStored);
  const [systemLang, setSystemLang] = useState<Lang>(detectSystemLang);

  useEffect(() => {
    setSystemLang(detectSystemLang());
  }, []);

  const setPreference = (next: Lang) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const lang: Lang = preference === "auto" ? systemLang : preference;

  return { preference, lang, setPreference };
}

import { useEffect, useState } from "react";
import { parseThemeSelectOption } from "@/lib/themeOptionValue";

export type NodeViewMode = "list" | "card";

const STORAGE_KEY = "komari-zen-view-mode";
const MANUAL_KEY = "komari-zen-view-mode-manual";

const MD_BREAKPOINT = 768;

function readStored(): NodeViewMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "list" || v === "card") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readManualOverride(): boolean {
  try {
    return localStorage.getItem(MANUAL_KEY) === "1";
  } catch {
    return false;
  }
}

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MD_BREAKPOINT;
}

export function useViewMode(defaultViewMode: NodeViewMode) {
  const [viewMode, setViewModeState] = useState<NodeViewMode>(() => {
    return readStored() ?? defaultViewMode;
  });
  const [isNarrow, setIsNarrow] = useState(isNarrowViewport);

  useEffect(() => {
    if (readStored() !== null) return;
    setViewModeState(defaultViewMode);
  }, [defaultViewMode]);

  useEffect(() => {
    const onResize = () => setIsNarrow(isNarrowViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveViewMode: NodeViewMode =
    isNarrow && !readManualOverride() ? "card" : viewMode;

  const setViewMode = (next: NodeViewMode) => {
    setViewModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem(MANUAL_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return { viewMode, effectiveViewMode, isNarrow, setViewMode };
}

export function parseDefaultViewMode(raw: unknown): NodeViewMode {
  const v = parseThemeSelectOption(raw, "Card");
  if (v === "List" || v === "list") return "list";
  return "card";
}

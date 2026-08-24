import type { RadixTagColor } from "@/lib/parseNodeTags";
import { zenInteractive } from "@/lib/zenSemantics";

const DEFAULT_CYCLE: RadixTagColor[] = [
  "green",
  "sky",
  "violet",
  "amber",
  "ruby",
  "teal",
];

type ThemeMode = "light" | "dark";

const TEXT_STYLES: Record<ThemeMode, Record<RadixTagColor, string>> = {
  dark: {
    ruby: "text-rose-400",
    gray: "text-zen-fg-muted",
    gold: "text-yellow-400",
    bronze: "text-orange-300",
    brown: "text-amber-400",
    yellow: "text-yellow-300",
    amber: "text-amber-400",
    orange: "text-orange-400",
    tomato: "text-red-400",
    red: "text-red-400",
    crimson: "text-rose-300",
    pink: "text-pink-400",
    plum: "text-fuchsia-300",
    purple: "text-purple-400",
    violet: "text-violet-400",
    iris: "text-indigo-300",
    indigo: "text-indigo-400",
    blue: "text-blue-400",
    cyan: "text-cyan-400",
    teal: "text-teal-400",
    jade: "text-emerald-400",
    green: "text-emerald-400",
    grass: "text-lime-400",
    lime: "text-lime-400",
    mint: "text-teal-300",
    sky: "text-sky-400",
  },
  light: {
    ruby: "text-rose-600",
    gray: "text-zen-fg-muted",
    gold: "text-yellow-700",
    bronze: "text-orange-700",
    brown: "text-amber-800",
    yellow: "text-yellow-700",
    amber: "text-amber-700",
    orange: "text-orange-700",
    tomato: "text-red-600",
    red: "text-red-600",
    crimson: "text-rose-700",
    pink: "text-pink-600",
    plum: "text-fuchsia-700",
    purple: "text-purple-700",
    violet: "text-violet-700",
    iris: "text-indigo-700",
    indigo: "text-indigo-700",
    blue: "text-blue-600",
    cyan: "text-cyan-700",
    teal: "text-teal-700",
    jade: "text-emerald-700",
    green: "text-emerald-700",
    grass: "text-lime-700",
    lime: "text-lime-700",
    mint: "text-teal-700",
    sky: "text-sky-700",
  },
};

const NEUTRAL_TEXT: Record<ThemeMode, string> = {
  dark: "text-zen-fg-subtle",
  light: "text-zen-fg-subtle",
};

export function getTagTextClass(
  color: RadixTagColor | null,
  index: number,
  theme: ThemeMode,
): string {
  const resolved =
    color ?? DEFAULT_CYCLE[index % DEFAULT_CYCLE.length];
  return TEXT_STYLES[theme][resolved] ?? NEUTRAL_TEXT[theme];
}

export function getTagSeparatorClass(_theme: ThemeMode): string {
  return "text-zen-fg-faint/70";
}

export function getTagOverflowTextClass(_theme: ThemeMode): string {
  return `${zenInteractive.iconIdle}`;
}

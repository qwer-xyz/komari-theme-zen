/** Shared semantic Tailwind classes — colors come from CSS vars, not theme branches. */

export const zenText = {
  primary: "text-zen-fg-strong",
  body: "text-zen-fg",
  muted: "text-zen-fg-muted font-medium",
  secondary: "text-zen-fg-muted",
  subtle: "text-zen-fg-subtle",
  faint: "text-zen-fg-faint",
  caption: "text-zen-fg-subtle font-mono",
  label: "text-zen-fg-subtle font-mono",
} as const;

export const zenBorder = {
  default: "border-zen-border",
  muted: "border-zen-border-muted",
  line: "border-zen-line",
  lineStrong: "border-zen-line-strong",
} as const;

export const zenFill = {
  skeleton: "bg-zen-fill-muted/50",
  track: "bg-zen-fill-muted/70",
  subtle: "bg-zen-fill-muted/12",
  hover: "hover:bg-zen-fill-muted/10",
} as const;

export const zenPopover =
  "border border-zen-border-muted bg-zen-surface/95 text-zen-fg-muted shadow-[0_4px_14px_rgba(0,0,0,0.08)]";

export const zenInteractive = {
  tabIdle:
    "text-zen-fg-faint hover:text-zen-fg-strong disabled:opacity-50",
  tabDivider: "text-zen-fg-faint/40 font-light",
  link: "text-zen-fg-muted font-semibold hover:text-zen-accent underline-offset-2 hover:underline transition-[color,transform] duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]",
  rangeIdle: "text-zen-fg-subtle hover:text-zen-fg-strong",
  iconIdle:
    "text-zen-fg-faint hover:text-zen-accent focus-visible:text-zen-accent",
  clear: "text-zen-fg-faint hover:text-zen-danger",
  separator: "text-zen-fg-faint/30",
} as const;

/** @license SPDX-License-Identifier: MIT */
import type { ReactNode } from "react";
import { AlertCircle, Info, RefreshCw, WifiOff } from "lucide-react";

type UIStateProps = {
  children: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "warning" | "offline";
  compact?: boolean;
  inline?: boolean;
  action?: { label: string; onClick: () => void; loading?: boolean };
};

export function UIState({ children, detail, tone = "neutral", compact = false, inline = false, action }: UIStateProps) {
  const Icon = tone === "offline" ? WifiOff : tone === "warning" ? AlertCircle : Info;
  return (
    <div role="status" className={`zen-state ${compact ? "zen-state-compact" : ""} ${inline ? "zen-state-inline" : ""}`} data-tone={tone}>
      <Icon className="zen-state-icon" size={18} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zen-fg-strong">{children}</p>
        {detail ? <div className="mt-1 text-sm leading-relaxed text-zen-fg-muted">{detail}</div> : null}
      </div>
      {action ? (
        <button type="button" disabled={action.loading} onClick={action.onClick} className="zen-control-trigger zen-state-action">
          <RefreshCw size={14} className={action.loading ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

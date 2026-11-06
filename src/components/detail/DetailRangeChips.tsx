/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import type { Messages } from "@/lib/i18n";
import { formatPreserveHoursLabel } from "@/lib/timeRangePresets";

interface DetailRangeChipsProps {
  hours: number[];
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
  messages: Messages;
  showLive?: boolean;
  isLive?: boolean;
  onLive?: () => void;
}

function chipClass(active: boolean) {
  return active
    ? "zen-control-trigger zen-range-chip bg-zen-chip font-medium text-zen-chip-fg"
    : "zen-control-trigger zen-range-chip font-normal text-zen-fg-muted hover:text-zen-fg-strong";
}

export function DetailRangeChips({
  hours,
  value,
  onChange,
  disabled = false,
  messages,
  showLive = false,
  isLive = false,
  onLive,
}: DetailRangeChipsProps) {
  if (!showLive && hours.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label={messages.historyRange}
      className="flex max-w-full flex-wrap items-center gap-x-1 gap-y-1"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const items = Array.from((event.currentTarget as HTMLDivElement).querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (!items.length) return;
        event.preventDefault();
        const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
        items[next]?.click();
      }}
    >
      {showLive ? (
        <button
          type="button"
          role="tab"
          aria-selected={isLive}
          disabled={disabled}
          onClick={onLive}
          className={`${chipClass(isLive)} cursor-pointer disabled:cursor-default`}
        >
          {messages.live}
        </button>
      ) : null}
      {hours.map((hoursValue) => {
        const active = !isLive && value === hoursValue;
        return (
          <button
            key={hoursValue}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(hoursValue)}
            className={`${chipClass(active)} cursor-pointer disabled:cursor-default`}
          >
            {formatPreserveHoursLabel(hoursValue, messages)}
          </button>
        );
      })}
    </div>
  );
}

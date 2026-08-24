import React from "react";
import type { Messages } from "@/lib/i18n";
import { formatPreserveHoursLabel } from "@/lib/timeRangePresets";
import { zenType, zenTouch } from "@/lib/typography";
import { zenFill, zenInteractive } from "@/lib/zenSemantics";
import { ZenTabControl } from "@/components/motion/ZenTabControl";

interface HistoryRangeSelectorProps {
  presets: number[];
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
  theme: "light" | "dark";
  messages: Messages;
  showLive?: boolean;
  isLive?: boolean;
  onLive?: () => void;
  liveLabel?: string;
}

export function HistoryRangeSelector({
  presets,
  value,
  onChange,
  disabled = false,
  theme: _theme,
  messages,
  showLive = false,
  isLive = false,
  onLive,
  liveLabel = "LIVE",
}: HistoryRangeSelectorProps) {
  if (presets.length === 0 && !showLive) return null;

  const tabs = [
    ...(showLive
      ? [
          {
            id: "live",
            label: liveLabel,
            disabled,
            leading: (
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isLive ? "bg-zen-accent animate-pulse" : zenFill.track
                }`}
              />
            ),
          },
        ]
      : []),
    ...presets.map((h) => ({
      id: String(h),
      label: formatPreserveHoursLabel(h, messages),
      disabled,
    })),
  ];

  const activeId = isLive ? "live" : String(value);

  return (
    <div className="max-w-full overflow-x-auto">
      <ZenTabControl
        tabs={tabs}
        value={activeId}
        onChange={(id) => {
          if (id === "live") onLive?.();
          else onChange(Number(id));
        }}
        tabClassName={`px-1.5 ${zenTouch.btn} uppercase tracking-widest font-black whitespace-nowrap font-mono ${zenType.caption}`}
        idleClassName={zenInteractive.rangeIdle}
        className="gap-3 sm:gap-6 shrink-0 select-none"
      />
    </div>
  );
}

import React from "react";
import { createPortal } from "react-dom";
import type { LatencyColorConfig, LatencySample } from "@/lib/latencyDisplay";
import {
  computeLatencyMean,
  formatLatencyDelta,
  formatLatencyMs,
  formatLatencyTooltipTime,
  latencyBlockColor,
  latencyBlockFillClass,
  LATENCY_HISTORY_LEN,
  metricWidgetGridClass,
  padLatencyHistory,
} from "@/lib/latencyDisplay";
import { MetricBarTrack } from "@/components/MetricSegmentBar";
import { zenType } from "@/lib/typography";
import { zenPopover } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";

interface LatencyHistoryBlocksProps {
  samples: LatencySample[];
  currentMs: number;
  theme: "light" | "dark";
  textPrimary: string;
  colorConfig: LatencyColorConfig;
  /** Extra classes on the outer wrapper (e.g. card row alignment). */
  className?: string;
  /** Open full latency probe panel (e.g. from node table). */
  onValueClick?: () => void;
}

const VIEWPORT_PAD = 8;

function computeTooltipCoords(
  trigger: HTMLElement,
  panel: HTMLElement,
): { top: number; left: number } {
  const tr = trigger.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const gap = 6;

  let left = tr.left + tr.width / 2 - pw / 2;
  let top = tr.top - ph - gap;

  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
  if (left + pw > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - VIEWPORT_PAD - pw;
  }

  if (top < VIEWPORT_PAD) {
    top = tr.bottom + gap;
  }
  if (top + ph > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, tr.top - ph - gap);
  }

  return { top, left };
}

type LatencyBlockProps = {
  sample: LatencySample;
  theme: "light" | "dark";
  colorConfig: LatencyColorConfig;
  mean: number | null;
  setTriggerRef: (el: HTMLSpanElement | null) => void;
  onShow: () => void;
  onHide: () => void;
  onTogglePinned: (event: React.MouseEvent | React.KeyboardEvent) => void;
};

function LatencyBlock({
  sample,
  theme,
  colorConfig,
  mean,
  setTriggerRef,
  onShow,
  onHide,
  onTogglePinned,
}: LatencyBlockProps) {
  const hasData = sample.ms > 0 && sample.t > 0;

  const tipText = React.useMemo(() => {
    if (!hasData) return "";
    let tip = `${formatLatencyTooltipTime(sample.t)} · ${formatLatencyMs(sample.ms)}`;
    if (colorConfig.mode === "MeanDelta" && mean != null && mean > 0) {
      tip += ` (${formatLatencyDelta(sample.ms - mean)})`;
    }
    return tip;
  }, [hasData, sample.t, sample.ms, colorConfig.mode, mean]);

  const fillClass = hasData
    ? latencyBlockFillClass(sample.ms, theme, colorConfig, mean)
    : "bg-zen-fill-muted/55";

  return (
    <span
      ref={setTriggerRef}
      role={hasData ? "button" : undefined}
      tabIndex={hasData ? 0 : undefined}
      aria-label={hasData ? tipText : undefined}
      className={`flex h-full min-w-0 items-end ${hasData ? "cursor-pointer" : "cursor-default"}`}
      onMouseEnter={hasData ? onShow : undefined}
      onMouseLeave={hasData ? onHide : undefined}
      onFocus={hasData ? onShow : undefined}
      onBlur={hasData ? onHide : undefined}
      onClick={hasData ? onTogglePinned : undefined}
      onKeyDown={
        hasData
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTogglePinned(event);
              }
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className={`block w-full min-h-[2px] rounded-[0.5px] ${fillClass} ${
          hasData ? "h-[85%]" : "h-[45%]"
        }`}
      />
    </span>
  );
}

type ActiveTooltip = {
  index: number;
  pinned: boolean;
};

function buildTipText(
  sample: LatencySample | undefined,
  colorConfig: LatencyColorConfig,
  mean: number | null,
): string {
  if (!sample || sample.ms <= 0 || sample.t <= 0) return "";
  let tip = `${formatLatencyTooltipTime(sample.t)} · ${formatLatencyMs(sample.ms)}`;
  if (colorConfig.mode === "MeanDelta" && mean != null && mean > 0) {
    tip += ` (${formatLatencyDelta(sample.ms - mean)})`;
  }
  return tip;
}

function isLatencySampleVisible(sample: LatencySample | undefined): boolean {
  return !!sample && sample.ms > 0 && sample.t > 0;
}

function LatencyTooltipPortal({
  active,
  blocks,
  colorConfig,
  mean,
  triggerRefs,
  onClose,
}: {
  active: ActiveTooltip | null;
  blocks: LatencySample[];
  colorConfig: LatencyColorConfig;
  mean: number | null;
  triggerRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const [visible, setVisible] = React.useState(false);
  const sample = active ? blocks[active.index] : undefined;
  const tipText = React.useMemo(
    () => buildTipText(sample, colorConfig, mean),
    [sample, colorConfig, mean],
  );
  const panelClass = zenPopover;

  const reposition = React.useCallback(() => {
    if (!active) return;
    const trigger = triggerRefs.current[active.index];
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    setCoords(computeTooltipCoords(trigger, panel));
    setVisible(true);
  }, [active, triggerRefs]);

  React.useLayoutEffect(() => {
    if (!active || !tipText) {
      setVisible(false);
      return;
    }
    reposition();
  }, [active, tipText, reposition]);

  React.useEffect(() => {
    if (!active) return;
    const onReflow = () => reposition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [active, reposition]);

  React.useEffect(() => {
    if (!active?.pinned) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRefs.current[active.index]?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };
    document.addEventListener("click", onDoc, true);
    return () => document.removeEventListener("click", onDoc, true);
  }, [active, onClose, triggerRefs]);

  if (!active || !tipText) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        pointerEvents: active.pinned ? "auto" : "none",
      }}
      className={`whitespace-nowrap rounded-sm px-2 py-1 font-mono ${zenType.caption} tracking-wide ${panelClass} ${zenMotion.popover} ${visible ? zenMotion.popoverVisible : ""}`}
      onMouseLeave={() => {
        if (!active.pinned) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {tipText}
    </div>,
    document.body,
  );
}

const MemoLatencyBlock = React.memo(LatencyBlock);

export function LatencyHistoryBlocks({
  samples,
  currentMs,
  theme,
  textPrimary,
  colorConfig,
  className = "",
  onValueClick,
}: LatencyHistoryBlocksProps) {
  const blocks = React.useMemo(() => padLatencyHistory(samples), [samples]);
  const mean = React.useMemo(() => computeLatencyMean(blocks), [blocks]);
  const triggerRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const [activeTooltip, setActiveTooltip] =
    React.useState<ActiveTooltip | null>(null);

  React.useEffect(() => {
    triggerRefs.current.length = blocks.length;
  }, [blocks.length]);

  React.useEffect(() => {
    setActiveTooltip((active) =>
      active && isLatencySampleVisible(blocks[active.index]) ? active : null,
    );
  }, [blocks]);

  const closeTooltip = React.useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const hideTooltip = React.useCallback(() => {
    setActiveTooltip((active) => (active?.pinned ? active : null));
  }, []);

  const showTooltip = React.useCallback((index: number) => {
    setActiveTooltip({ index, pinned: false });
  }, []);

  const togglePinnedTooltip = React.useCallback(
    (index: number, event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation();
      if (!isLatencySampleVisible(blocks[index])) return;
      setActiveTooltip((active) =>
        active?.index === index && active.pinned
          ? null
          : { index, pinned: true },
      );
    },
    [blocks],
  );

  const valueColor =
    currentMs > 0
      ? latencyBlockColor(currentMs, theme, colorConfig, mean)
      : textPrimary;
  const valueLabel = formatLatencyMs(currentMs);

  return (
    <span className={`${metricWidgetGridClass} ${className}`.trim()}>
      <span
        role={onValueClick && currentMs > 0 ? "button" : undefined}
        tabIndex={onValueClick && currentMs > 0 ? 0 : undefined}
        className={`text-right font-bold tabular-nums ${valueColor} ${
          onValueClick && currentMs > 0
            ? "cursor-pointer hover:opacity-80 transition-opacity"
            : ""
        }`}
        onClick={
          onValueClick && currentMs > 0
            ? (e) => {
                e.stopPropagation();
                onValueClick();
              }
            : undefined
        }
        onKeyDown={
          onValueClick && currentMs > 0
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onValueClick();
                }
              }
            : undefined
        }
      >
        {valueLabel}
      </span>
      <MetricBarTrack>
        <span
          className="grid h-full w-full gap-px"
          style={{
            gridTemplateColumns: `repeat(${LATENCY_HISTORY_LEN}, minmax(0, 1fr))`,
          }}
        >
          {blocks.map((sample, i) => (
            <MemoLatencyBlock
              key={`${sample.t}-${i}`}
              sample={sample}
              theme={theme}
              colorConfig={colorConfig}
              mean={mean}
              setTriggerRef={(el) => {
                triggerRefs.current[i] = el;
              }}
              onShow={() => showTooltip(i)}
              onHide={hideTooltip}
              onTogglePinned={(event) => togglePinnedTooltip(i, event)}
            />
          ))}
        </span>
      </MetricBarTrack>
      <LatencyTooltipPortal
        active={activeTooltip}
        blocks={blocks}
        colorConfig={colorConfig}
        mean={mean}
        triggerRefs={triggerRefs}
        onClose={closeTooltip}
      />
    </span>
  );
}

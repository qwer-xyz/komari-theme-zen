import React from "react";
import type { TimeRange } from "@/hooks/usePingChartViewport";
import type { PingPoint } from "@/lib/pingChartSeries";

type PingChartOverviewProps = {
  fullRange: TimeRange;
  viewRange: TimeRange;
  envelope: PingPoint[];
  onViewRangeChange: (range: TimeRange) => void;
  onResetZoom: () => void;
  theme: "light" | "dark";
  ariaLabel: string;
  keyboardHelp: string;
};

const HEIGHT = 44;
const PADDING_X = 8;

function rangeToX(t: number, range: TimeRange, width: number): number {
  const [start, end] = range;
  const span = Math.max(1, end - start);
  return PADDING_X + ((t - start) / span) * (width - PADDING_X * 2);
}

function xToTime(x: number, range: TimeRange, width: number): number {
  const [start, end] = range;
  const chartWidth = width - PADDING_X * 2;
  const ratio = Math.max(0, Math.min(1, (x - PADDING_X) / chartWidth));
  return start + ratio * (end - start);
}

export function PingChartOverview({
  fullRange,
  viewRange,
  envelope,
  onViewRangeChange,
  onResetZoom,
  theme,
  ariaLabel,
  keyboardHelp,
}: PingChartOverviewProps) {
  const width = 1000;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef<
    | {
        kind: "left" | "right" | "pan" | "select";
        startSvgX: number;
        origView: TimeRange;
        selectStart?: number;
      }
    | null
  >(null);
  const moveFrameRef = React.useRef<number | null>(null);
  const pendingClientXRef = React.useRef<number | null>(null);
  const keyboardHelpId = React.useId();

  const chartHeight = HEIGHT - 12;

  const envelopePath = React.useMemo(() => {
    if (envelope.length === 0) return "";
    const values = envelope.map((p) => p.v);
    const maxV = Math.max(50, ...values);
    let d = "";
    let started = false;
    for (const p of envelope) {
      const x = rangeToX(p.t, fullRange, width);
      const y = 4 + (1 - p.v / maxV) * chartHeight;
      d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    }
    return d.trim();
  }, [envelope, fullRange, chartHeight]);

  const selLeft = rangeToX(viewRange[0], fullRange, width);
  const selRight = rangeToX(viewRange[1], fullRange, width);
  const selWidth = Math.max(2, selRight - selLeft);

  const trackColor =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const handleColor =
    theme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)";
  const selectionFill =
    theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      const svg = svgRef.current;
      if (!drag || !svg) return;

      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / rect.width) * width;
      const [fullStart, fullEnd] = fullRange;

      if (drag.kind === "left") {
        const t = xToTime(svgX, fullRange, width);
        onViewRangeChange([Math.max(fullStart, Math.min(t, drag.origView[1] - 60_000)), drag.origView[1]]);
      } else if (drag.kind === "right") {
        const t = xToTime(svgX, fullRange, width);
        onViewRangeChange([drag.origView[0], Math.min(fullEnd, Math.max(t, drag.origView[0] + 60_000))]);
      } else if (drag.kind === "pan") {
        const dt = xToTime(svgX, fullRange, width) - xToTime(drag.startSvgX, fullRange, width);
        const span = drag.origView[1] - drag.origView[0];
        let start = drag.origView[0] - dt;
        let end = start + span;
        if (start < fullStart) {
          start = fullStart;
          end = start + span;
        }
        if (end > fullEnd) {
          end = fullEnd;
          start = end - span;
        }
        onViewRangeChange([start, end]);
      } else if (drag.kind === "select" && drag.selectStart != null) {
        const t = xToTime(svgX, fullRange, width);
        const a = Math.min(drag.selectStart, t);
        const b = Math.max(drag.selectStart, t);
        if (b - a >= 60_000) {
          onViewRangeChange([a, b]);
        }
      }
    },
    [fullRange, onViewRangeChange],
  );

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      pendingClientXRef.current = e.clientX;
      if (moveFrameRef.current !== null) return;
      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = null;
        const clientX = pendingClientXRef.current;
        if (clientX !== null) updateFromClientX(clientX);
      });
    };
    const clearScheduledMove = () => {
      if (moveFrameRef.current !== null) {
        window.cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = null;
      }
    };
    const onUp = (event: PointerEvent) => {
      if (dragRef.current) {
        clearScheduledMove();
        updateFromClientX(event.clientX);
      }
      dragRef.current = null;
      pendingClientXRef.current = null;
    };
    const onCancel = () => {
      clearScheduledMove();
      dragRef.current = null;
      pendingClientXRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      clearScheduledMove();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [updateFromClientX]);

  const handleRangeKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const [fullStart, fullEnd] = fullRange;
    const [viewStart, viewEnd] = viewRange;
    const span = Math.max(60_000, viewEnd - viewStart);
    if (event.key === "Home") {
      event.preventDefault();
      onResetZoom();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onViewRangeChange([Math.max(fullStart, fullEnd - span), fullEnd]);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = span * 0.1 * (event.key === "ArrowLeft" ? -1 : 1);
      const start = Math.max(
        fullStart,
        Math.min(viewStart + delta, fullEnd - span),
      );
      onViewRangeChange([start, start + span]);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const factor = event.key === "ArrowUp" ? 0.8 : 1.25;
      const nextSpan = Math.max(
        60_000,
        Math.min(fullEnd - fullStart, span * factor),
      );
      const center = (viewStart + viewEnd) / 2;
      let start = center - nextSpan / 2;
      start = Math.max(fullStart, Math.min(start, fullEnd - nextSpan));
      onViewRangeChange([start, start + nextSpan]);
    }
  };

  const beginDrag = (
    kind: NonNullable<typeof dragRef.current>["kind"],
    svgX: number,
    origView: TimeRange,
    selectStart?: number,
  ) => {
    dragRef.current = { kind, startSvgX: svgX, origView, selectStart };
  };

  const pointerX = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * width;
  };

  return (
    <div className="relative select-none touch-pan-y">
      <span id={keyboardHelpId} className="sr-only">
        {keyboardHelp}
      </span>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-11 cursor-crosshair"
        aria-label={`${ariaLabel}: ${new Date(viewRange[0]).toLocaleString()} – ${new Date(viewRange[1]).toLocaleString()}`}
        aria-describedby={keyboardHelpId}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
        role="group"
        tabIndex={0}
        onKeyDown={handleRangeKeyDown}
        onDoubleClick={onResetZoom}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const x = pointerX(e);
          const t = xToTime(x, fullRange, width);
          if (Math.abs(x - selLeft) <= 10) {
            beginDrag("left", x, viewRange);
          } else if (Math.abs(x - selRight) <= 10) {
            beginDrag("right", x, viewRange);
          } else if (x >= selLeft && x <= selRight) {
            beginDrag("pan", x, viewRange);
          } else {
            beginDrag("select", x, viewRange, t);
          }
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
      >
        <rect x={0} y={0} width={width} height={HEIGHT} fill="transparent" />
        <rect
          x={PADDING_X}
          y={4}
          width={width - PADDING_X * 2}
          height={chartHeight}
          fill={trackColor}
          rx={2}
        />
        {envelopePath ? (
          <path
            d={envelopePath}
            fill="none"
            stroke={theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)"}
            strokeWidth={1.2}
          />
        ) : null}
        <rect
          x={selLeft}
          y={2}
          width={selWidth}
          height={HEIGHT - 4}
          fill={selectionFill}
          stroke={handleColor}
          strokeWidth={1}
          rx={2}
        />
        <rect
          x={selLeft - 3}
          y={6}
          width={6}
          height={HEIGHT - 12}
          fill={handleColor}
          rx={1}
        />
        <rect
          x={selRight - 3}
          y={6}
          width={6}
          height={HEIGHT - 12}
          fill={handleColor}
          rx={1}
        />
      </svg>
    </div>
  );
}

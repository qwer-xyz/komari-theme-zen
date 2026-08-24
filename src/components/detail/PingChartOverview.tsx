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
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromClientX]);

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
    <div className="relative select-none touch-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-11 cursor-crosshair"
        aria-label={ariaLabel}
        role="img"
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

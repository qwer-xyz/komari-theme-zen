/** @license SPDX-License-Identifier: MIT */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { chartTooltipPosition } from "@/lib/chartTooltip";

export function ChartTooltip({ id, anchorRef, xRatio, yRatio = 0.5, timeLabel, children }: {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  xRatio: number;
  yRatio?: number;
  timeLabel?: string;
  children: ReactNode;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) return;
      const plot = anchor.querySelector("[data-chart-main]") ?? anchor;
      const next = chartTooltipPosition(
        plot.getBoundingClientRect(), tooltip.getBoundingClientRect(),
        { width: document.documentElement.clientWidth, height: window.innerHeight }, xRatio, yRatio,
      );
      setPosition(previous => previous?.left === next.left && previous?.top === next.top ? previous : next);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, xRatio, yRatio, children, timeLabel]);

  return createPortal(
    <div ref={tooltipRef} id={id} role="tooltip" className="zen-chart-tooltip" style={{ ...position, visibility: position ? "visible" : "hidden" }}>
      {timeLabel ? <div className="zen-chart-tooltip-time">{timeLabel}</div> : null}
      {children}
    </div>,
    document.body,
  );
}

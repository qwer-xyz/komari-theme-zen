/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { VPSNode } from "@/types";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { resolveCountryCode } from "@/lib/regionCode";
import { worldMapData } from "@/lib/worldMapData";
import { zenType } from "@/lib/typography";
import { zenPopover, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";

export type NodeDistributionMapNode = Pick<
  VPSNode,
  "id" | "name" | "flag" | "status"
>;

type RegionNode = {
  id: string;
  name: string;
  status: VPSNode["status"];
};

type RegionCluster = {
  code: string;
  x: number;
  y: number;
  total: number;
  online: number;
  unknown: number;
  nodes: RegionNode[];
};

type MapLayout = {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

interface NodeDistributionMapProps {
  nodes: NodeDistributionMapNode[];
  theme: "light" | "dark";
  lang: Lang;
  /** Inline section on mobile; modal body on desktop popup. */
  presentation?: "inline" | "modal";
  /** Hide section title row (e.g. mobile collapsible inside header stats). */
  hideHeader?: boolean;
  /** Tighter layout when nested inside another panel. */
  embedded?: boolean;
}

const MAP_W = worldMapData.w;
const MAP_H = worldMapData.h;
const DESKTOP_MQ = "(min-width: 768px)";
/** Mobile map canvas width — wider than viewport, scroll to pan */
const MOBILE_MAP_WIDTH = 720;

function buildRegionClusters(nodes: NodeDistributionMapNode[]): RegionCluster[] {
  const groups = new Map<
    string,
    { total: number; online: number; unknown: number; regionNodes: RegionNode[] }
  >();

  for (const node of nodes) {
    const code = resolveCountryCode(node.flag);
    if (!code) continue;
    const entry = groups.get(code) ?? {
      total: 0,
      online: 0,
      unknown: 0,
      regionNodes: [],
    };
    entry.total += 1;
    if (node.status === "online") entry.online += 1;
    if (node.status === "unknown") entry.unknown += 1;
    entry.regionNodes.push({
      id: node.id,
      name: node.name,
      status: node.status,
    });
    groups.set(code, entry);
  }

  const clusters: RegionCluster[] = [];
  for (const [code, stats] of groups) {
    const centroid = worldMapData.centroids[code];
    if (!centroid) continue;

    clusters.push({
      code,
      x: centroid[0],
      y: centroid[1],
      total: stats.total,
      online: stats.online,
      unknown: stats.unknown,
      nodes: stats.regionNodes,
    });
  }

  return clusters;
}

function computeMapLayout(rect: DOMRect): MapLayout {
  const scale = Math.min(rect.width / MAP_W, rect.height / MAP_H);
  return {
    width: rect.width,
    height: rect.height,
    scale,
    offsetX: (rect.width - MAP_W * scale) / 2,
    offsetY: (rect.height - MAP_H * scale) / 2,
  };
}

function mapLayoutsEqual(a: MapLayout | null, b: MapLayout): boolean {
  return (
    a !== null &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    Math.abs(a.scale - b.scale) < 0.001 &&
    Math.abs(a.offsetX - b.offsetX) < 0.5 &&
    Math.abs(a.offsetY - b.offsetY) < 0.5
  );
}

function mapPointToScreen(
  x: number,
  y: number,
  layout: MapLayout,
): { left: number; top: number } {
  return {
    left: layout.offsetX + x * layout.scale,
    top: layout.offsetY + y * layout.scale,
  };
}

function drawDotLayer(
  canvas: HTMLCanvasElement,
  theme: "light" | "dark",
  density: "full" | "compact",
): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr =
    density === "compact" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const layout = computeMapLayout(rect);

  ctx.fillStyle =
    theme === "dark" ? "rgba(115, 115, 115, 0.55)" : "rgba(163, 163, 163, 0.65)";
  const radius =
    density === "compact"
      ? Math.max(0.7, layout.scale * 0.8)
      : Math.max(0.75, layout.scale * 0.95);
  const step = density === "compact" ? 4 : 2;

  const { dots } = worldMapData;
  if (density === "compact") {
    const size = Math.max(1, radius * 1.35);
    for (let i = 0; i < dots.length; i += step) {
      const x = layout.offsetX + dots[i] * layout.scale;
      const y = layout.offsetY + dots[i + 1] * layout.scale;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    return;
  }

  ctx.beginPath();
  for (let i = 0; i < dots.length; i += step) {
    const x = layout.offsetX + dots[i] * layout.scale;
    const y = layout.offsetY + dots[i + 1] * layout.scale;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  ctx.fill();
}

function RegionClusterPanel({
  cluster,
  theme,
  lang,
  className = "",
  id,
}: {
  cluster: RegionCluster;
  theme: "light" | "dark";
  lang: Lang;
  className?: string;
  id?: string;
}) {
  const t = translations[lang];
  const shellClass = `${zenPopover} font-mono normal-case ${zenType.caption} tracking-normal`;

  return (
    <div
      id={id}
      className={`rounded-sm border px-2.5 py-2 font-mono normal-case ${zenType.caption} tracking-normal ${shellClass} ${className}`}
    >
      <div className="font-bold mb-1.5 pb-1 border-b border-zen-line/80">
        {t.mapRegionTooltip(cluster.code, cluster.online, cluster.total)}
        {cluster.unknown > 0
          ? ` · ${t.statusUnknown}: ${cluster.unknown}`
          : ""}
      </div>
      <ul className="space-y-0.5">
        {cluster.nodes.map((node) => (
          <li
            key={node.id}
            className={`flex items-center gap-1.5 leading-snug min-w-0 ${
              node.status === "offline" ? "opacity-60" : ""
            }`}
          >
            <span
              className={`shrink-0 ${
                node.status === "online"
                  ? "text-zen-accent"
                  : node.status === "unknown"
                    ? "text-zen-warning"
                    : zenText.subtle
              }`}
              aria-hidden
            >
              {node.status === "online"
                ? "●"
                : node.status === "unknown"
                  ? "◇"
                  : "○"}
            </span>
            <span className="sr-only">
              {node.status === "online"
                ? t.hostOnline
                : node.status === "offline"
                  ? t.connectionOffline
                  : t.statusUnknown}
              {": "}
            </span>
            <span className="min-w-0 flex-1 truncate" title={node.name}>
              {node.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function desktopTooltipStyle(
  cluster: RegionCluster,
  layout: MapLayout,
): React.CSSProperties {
  const { left, top } = mapPointToScreen(cluster.x, cluster.y, layout);
  const placeBelow = top < layout.height * 0.28;

  return {
    left,
    top,
    transform: placeBelow
      ? "translate(-50%, 14px)"
      : "translate(-50%, calc(-100% - 12px))",
  };
}

export const NodeDistributionMap = React.memo(function NodeDistributionMap({
  nodes,
  theme,
  lang,
  presentation = "inline",
  hideHeader = false,
  embedded = false,
}: NodeDistributionMapProps) {
  const isModal = presentation === "modal";
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [tappedCode, setTappedCode] = useState<string | null>(null);
  const [mapLayout, setMapLayout] = useState<MapLayout | null>(null);
  const panelIdPrefix = React.useId();
  const hoverClearTimerRef = useRef<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches,
  );
  const clusters = useMemo(() => buildRegionClusters(nodes), [nodes]);
  const hovered = clusters.find((cluster) => cluster.code === hoveredCode) ?? null;
  const tapped = clusters.find((cluster) => cluster.code === tappedCode) ?? null;
  const hasClusters = clusters.length > 0;
  const effectiveDesktop = isModal || isDesktop;

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setTappedCode(null);
      else setHoveredCode(null);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isDesktop) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const center = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
    scroller.scrollLeft = center;
  }, [isDesktop, clusters.length]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let raf = 0;

    const refresh = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      if (effectiveDesktop) {
        const nextLayout = computeMapLayout(rect);
        setMapLayout((prev) =>
          mapLayoutsEqual(prev, nextLayout) ? prev : nextLayout,
        );
      } else {
        setMapLayout(null);
      }
      drawDotLayer(canvas, theme, effectiveDesktop ? "full" : "compact");
    };

    const scheduleRefresh = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        refresh();
      });
    };

    refresh();
    const ro = new ResizeObserver(scheduleRefresh);
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [theme, effectiveDesktop, hasClusters]);

  const t = translations[lang];
  const textMuted = zenText.subtle;
  const markerFillOnline = "var(--zen-accent)";
  const markerFillOffline = theme === "dark" ? "#737373" : "#a3a3a3";

  const toggleTapped = (cluster: RegionCluster) => {
    setTappedCode((previous) =>
      previous === cluster.code ? null : cluster.code,
    );
  };

  const showClusterTooltip = (cluster: RegionCluster) => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
    setHoveredCode(cluster.code);
  };

  const hideClusterTooltip = () => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
    }
    hoverClearTimerRef.current = window.setTimeout(() => {
      setHoveredCode(null);
      hoverClearTimerRef.current = null;
    }, 64);
  };

  const selectNearestCluster = (
    event: React.MouseEvent<SVGSVGElement>,
  ) => {
    if (isDesktop || clusters.length === 0) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    let nearest: RegionCluster | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const point = event.currentTarget.createSVGPoint();
    for (const cluster of clusters) {
      point.x = cluster.x;
      point.y = cluster.y;
      const screen = point.matrixTransform(matrix);
      const distance = Math.hypot(
        screen.x - event.clientX,
        screen.y - event.clientY,
      );
      if (distance < nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }
    // Resolve dense regions by nearest centroid instead of overlapping large
    // invisible circles. The whole map remains tappable without selecting a
    // distant marker when the user taps empty ocean.
    if (nearest && nearestDistance <= 32) toggleTapped(nearest);
  };

  useEffect(
    () => () => {
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
      }
    },
    [],
  );

  if (clusters.length === 0) return null;

  return (
    <section
      aria-label={isModal || hideHeader ? undefined : t.lblNodeDistribution}
      className={
        isModal
          ? "w-full"
          : embedded
            ? "w-full"
            : "w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)]"
      }
    >
      {!isModal && !hideHeader ? (
        <div className="flex items-center gap-3 mb-1 md:mb-2.5 max-md:px-4">
          <span
            className={`${zenType.section} zen-track-tight ${textMuted} font-mono uppercase shrink-0`}
          >
            {t.lblNodeDistribution}
          </span>
          <span className="h-px flex-1 bg-zen-line" aria-hidden />
          <span
            className={`md:hidden shrink-0 ${zenType.caption} ${textMuted} font-mono normal-case tracking-normal`}
          >
            {t.mapScrollHint}
          </span>
        </div>
      ) : null}

      <div className={isModal ? undefined : "max-md:relative"}>
        {!isModal ? (
          <>
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-5 md:hidden bg-gradient-to-r ${
                theme === "dark" ? "from-zen-bg/95" : "from-zen-bg/90"
              } to-transparent`}
              aria-hidden
            />
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 md:hidden bg-gradient-to-l ${
                theme === "dark" ? "from-zen-bg/95" : "from-zen-bg/90"
              } to-transparent`}
              aria-hidden
            />
          </>
        ) : null}

        <div
          ref={scrollRef}
          className={
            isModal
              ? undefined
              : "max-md:overflow-x-auto max-md:overscroll-x-contain max-md:touch-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          }
        >
          <div
            ref={containerRef}
            className={
              isModal
                ? "relative mx-auto aspect-[2/1] w-full touch-manipulation"
                : "relative mx-auto aspect-[2/1] touch-manipulation max-md:min-w-[720px] max-md:w-[720px] max-md:shrink-0 md:w-full md:max-h-none lg:w-[min(100%,1120px)] xl:w-[min(100%,1280px)]"
            }
            style={
              !effectiveDesktop ? { width: MOBILE_MAP_WIDTH, minWidth: MOBILE_MAP_WIDTH } : undefined
            }
          >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full pointer-events-none"
          aria-hidden
        />

        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={t.lblNodeDistribution}
          onClick={selectNearestCluster}
        >
          <rect
            width={MAP_W}
            height={MAP_H}
            fill="transparent"
            pointerEvents="all"
            aria-hidden
          />
          {clusters.map((cluster, index) => {
            const hasOnline = cluster.online > 0;
            const hasUnknown = cluster.unknown > 0;
            const fill = hasOnline
              ? markerFillOnline
              : hasUnknown
                ? "var(--zen-warning)"
                : markerFillOffline;
            const r = isDesktop ? 5 : isModal ? 8 : 5.5;
            const isTapped = tapped?.code === cluster.code;
            const twinkleDelay = `${((index * 0.83) % 3.6).toFixed(2)}s`;
            const hitRadius = isDesktop ? 14 : r + 4;
            const regionPanelId = `${panelIdPrefix}-${cluster.code}`;

            return (
              <g
                key={cluster.code}
                role="button"
                tabIndex={0}
                aria-expanded={!isDesktop ? isTapped : undefined}
                aria-controls={!isDesktop && isTapped ? regionPanelId : undefined}
                aria-label={t.mapRegionTooltip(
                  cluster.code,
                  cluster.online,
                  cluster.nodes.length,
                ) +
                  (cluster.unknown > 0
                    ? ` · ${t.statusUnknown}: ${cluster.unknown}`
                    : "")}
                onMouseEnter={isDesktop ? () => showClusterTooltip(cluster) : undefined}
                onMouseLeave={isDesktop ? hideClusterTooltip : undefined}
                onClick={(event) => {
                  // Assistive technology activates role=button with a
                  // coordinate-less click. Pointer clicks keep bubbling to the
                  // map-wide nearest-centroid resolver for dense regions.
                  if (event.detail !== 0) return;
                  event.stopPropagation();
                  if (isDesktop) showClusterTooltip(cluster);
                  else toggleTapped(cluster);
                }}
                onFocus={
                  isDesktop ? () => showClusterTooltip(cluster) : undefined
                }
                onBlur={isDesktop ? hideClusterTooltip : undefined}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (isDesktop) showClusterTooltip(cluster);
                  else toggleTapped(cluster);
                }}
              >
                <circle
                  cx={cluster.x}
                  cy={cluster.y}
                  r={hitRadius}
                  fill="transparent"
                  aria-hidden
                />
                <g transform={`translate(${cluster.x} ${cluster.y})`}>
                  {effectiveDesktop && hasOnline ? (
                    <>
                      <circle
                        cx={0}
                        cy={0}
                        r={r + 5}
                        fill={fill}
                        className="zen-map-star-halo"
                        style={{ animationDelay: twinkleDelay }}
                      />
                      <circle
                        cx={0}
                        cy={0}
                        r={r + 2.5}
                        fill={fill}
                        className="zen-map-star-glow"
                        style={{ animationDelay: `calc(${twinkleDelay} + 0.55s)` }}
                      />
                    </>
                  ) : null}
                  <circle
                    cx={0}
                    cy={0}
                    r={isTapped ? r + 1.5 : r}
                    fill={fill}
                    className={
                      effectiveDesktop && hasOnline
                        ? "zen-map-star-core"
                        : undefined
                    }
                    style={
                      effectiveDesktop && hasOnline
                        ? { animationDelay: `calc(${twinkleDelay} + 0.28s)` }
                        : undefined
                    }
                    opacity={hasOnline ? undefined : 0.72}
                    aria-hidden
                  />
                </g>
              </g>
            );
          })}
        </svg>

        {isDesktop && hovered && mapLayout ? (
          <div
            className={`pointer-events-none absolute z-10 w-[max(9rem,min(11rem,42vw))] ${isModal ? "block" : "hidden md:block"}`}
            style={desktopTooltipStyle(hovered, mapLayout)}
          >
            <div key={hovered.code} className={zenMotion.fadeIn}>
              <RegionClusterPanel cluster={hovered} theme={theme} lang={lang} />
            </div>
          </div>
        ) : null}
          </div>
        </div>
      </div>

      {!isDesktop && tapped ? (
        <div className={`md:hidden mt-2 ${isModal ? "" : "max-md:px-4"}`}>
          <RegionClusterPanel
            id={`${panelIdPrefix}-${tapped.code}`}
            cluster={tapped}
            theme={theme}
            lang={lang}
          />
        </div>
      ) : null}
    </section>
  );
}, areNodeDistributionMapPropsEqual);

NodeDistributionMap.displayName = "NodeDistributionMap";

function areMapNodesEqual(
  prev: NodeDistributionMapNode[],
  next: NodeDistributionMapNode[],
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.flag !== b.flag ||
      a.status !== b.status
    ) {
      return false;
    }
  }

  return true;
}

function areNodeDistributionMapPropsEqual(
  prev: NodeDistributionMapProps,
  next: NodeDistributionMapProps,
): boolean {
  return (
    prev.theme === next.theme &&
    prev.lang === next.lang &&
    prev.presentation === next.presentation &&
    prev.hideHeader === next.hideHeader &&
    prev.embedded === next.embedded &&
    areMapNodesEqual(prev.nodes, next.nodes)
  );
}

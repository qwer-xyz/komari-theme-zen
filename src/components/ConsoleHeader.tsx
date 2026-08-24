/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Settings, Globe } from "lucide-react";
import { VPSNode } from "../types";
import { translations, Lang, getLangMenuLabel, LANG_MENU_OPTIONS } from "../lib/i18n";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import {
  useThemeSettings,
  type LogoShape,
} from "@/hooks/useThemeSettings";
import type { ThemePreference } from "@/hooks/useThemePreference";
import { formatResourceUsageSummary, formatTrafficGb, resolveTrafficUsedGb } from "@/lib/formatUnits";
import { formatResidualCurrency } from "@/lib/residualValue";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";
import { NodeDistributionMapModal } from "@/components/NodeDistributionMapModal";
import type { NodeDistributionMapNode } from "@/components/NodeDistributionMap";
import { ResidualValueModal } from "@/components/ResidualValueModal";
import { useResidualValueSummary } from "@/hooks/useResidualValueSummary";

const NodeDistributionMap = lazy(() =>
  import("@/components/NodeDistributionMap").then((m) => ({
    default: m.NodeDistributionMap,
  })),
);

const KOMARI_DEFAULT_LOGO_URL = "/favicon.ico";

function mobileCopy(lang: Lang) {
  switch (lang) {
    case "en":
      return {
        nodeStatus: "NODE",
        cpuAvg: "CPU",
        cpuMax: "MAX CPU",
        bandwidth: "BW",
        bandwidthMax: "MAX BW",
        traffic: "TRAFFIC",
        regions: "REGIONS",
        residual: "RV",
        rx: "RX",
        tx: "TX",
        threads: "THR",
      };
    case "id":
      return {
        nodeStatus: "NODE",
        cpuAvg: "CPU",
        cpuMax: "CPU MAX",
        bandwidth: "BW",
        bandwidthMax: "BW MAX",
        traffic: "TRAFIK",
        regions: "WIL.",
        residual: "SISA",
        rx: "RX",
        tx: "TX",
        threads: "THR",
      };
    case "ja":
      return {
        nodeStatus: "ノード",
        cpuAvg: "CPU",
        cpuMax: "CPU最大",
        bandwidth: "帯域",
        bandwidthMax: "最大帯域",
        traffic: "通信量",
        regions: "地域",
        residual: "残額",
        rx: "RX",
        tx: "TX",
        threads: "スレッド",
      };
    case "zh-TW":
      return {
        nodeStatus: "節點",
        cpuAvg: "CPU",
        cpuMax: "CPU最大",
        bandwidth: "頻寬",
        bandwidthMax: "最大頻寬",
        traffic: "流量",
        regions: "地區",
        residual: "剩餘",
        rx: "RX",
        tx: "TX",
        threads: "執行緒",
      };
    case "zh":
    default:
      return {
        nodeStatus: "节点",
        cpuAvg: "CPU",
        cpuMax: "CPU最大",
        bandwidth: "带宽",
        bandwidthMax: "最大带宽",
        traffic: "流量",
        regions: "地区",
        residual: "剩余",
        rx: "RX",
        tx: "TX",
        threads: "线程",
      };
  }
}

function logoShapeClass(shape: LogoShape) {
  if (shape === "Circle") return "rounded-full";
  if (shape === "Square") return "rounded-none";
  return "rounded-md";
}

function HeaderLogo({
  showLogo,
  customLogoUrl,
  logoShape,
}: {
  showLogo: boolean;
  customLogoUrl: string;
  logoShape: LogoShape;
}) {
  const logoUrl = customLogoUrl || KOMARI_DEFAULT_LOGO_URL;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedUrl(null);
  }, [logoUrl]);

  if (!showLogo || !logoUrl || failedUrl === logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      loading="eager"
      onError={() => setFailedUrl(logoUrl)}
      className={`h-[1.05em] w-[1.05em] shrink-0 object-cover bg-zen-elevate/40 ring-1 ring-zen-line ${logoShapeClass(
        logoShape,
      )}`}
    />
  );
}

function useStableMapNodes(nodes: VPSNode[]): NodeDistributionMapNode[] {
  const ref = useRef<NodeDistributionMapNode[]>([]);

  return useMemo(() => {
    const next = nodes.map(({ id, name, flag, online }) => ({
      id,
      name,
      flag,
      online,
    }));

    const prev = ref.current;
    const unchanged =
      prev.length === next.length &&
      prev.every((node, index) => {
        const other = next[index];
        return (
          node.id === other.id &&
          node.name === other.name &&
          node.flag === other.flag &&
          node.online === other.online
        );
      });

    if (!unchanged) ref.current = next;
    return ref.current;
  }, [nodes]);
}

function MobileMetricHero({
  label,
  value,
  suffix,
  textMuted,
  textPrimary,
  textUnit,
}: {
  label: string;
  value: string;
  suffix?: string;
  textMuted: string;
  textPrimary: string;
  textUnit: string;
}) {
  return (
    <div className="min-w-0 flex flex-col items-center gap-1 px-0.5 text-center">
      <span
        className={`${zenType.label} zen-track-tight ${textMuted} w-full truncate whitespace-nowrap font-mono uppercase leading-tight`}
      >
        {label}
      </span>
      <div className="flex max-w-full items-baseline justify-center gap-0.5">
        <span
          className={`text-[clamp(1.375rem,6.8vw,2rem)] font-black ${textPrimary} leading-none tracking-tighter`}
        >
          {value}
        </span>
        {suffix ? (
          <span
            className={`text-[clamp(0.6875rem,2.6vw,0.8125rem)] ${textUnit} shrink-0 font-mono font-medium leading-none`}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LocalClock({
  label,
  loadingLabel,
  textMuted,
  textPrimary,
  compact = false,
  className = "",
}: {
  label: string;
  loadingLabel: string;
  textMuted: string;
  textPrimary: string;
  compact?: boolean;
  className?: string;
}) {
  const [localTime, setLocalTime] = useState<string>("");
  const [timeZone, setTimeZone] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimeZone(tz);
      setLocalTime(
        now.toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          ...(compact
            ? {}
            : {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }),
        }),
      );
    };
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, [compact]);

  return (
    <div className={className}>
      <span className={`${zenType.label} block ${textMuted} mb-1 zen-track-tight`}>
        {label}
      </span>
      <span className={`${textPrimary} text-base font-bold tracking-widest select-all`}>
        {localTime || loadingLabel}
      </span>
      {timeZone ? (
        <span className={`${zenType.label} mt-0.5 ${textMuted} tracking-wider normal-case`}>
          {timeZone}
        </span>
      ) : null}
    </div>
  );
}

interface ConsoleHeaderProps {
  nodes: VPSNode[];
  lang: Lang;
  setLangPreference: (l: Lang) => void;
  theme: "light" | "dark";
  themePreference: ThemePreference;
  setThemePreference: (t: ThemePreference) => void;
  view?: "dashboard" | "detail";
  showNodeMap?: boolean;
}

export function ConsoleHeader({
  nodes,
  lang,
  setLangPreference,
  theme,
  themePreference,
  setThemePreference,
  view = "dashboard",
  showNodeMap = false,
}: ConsoleHeaderProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [residualOpen, setResidualOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  const tm = mobileCopy(lang);
  const { publicInfo } = usePublicInfo();
  const {
    showLogo,
    customLogoUrl,
    logoShape,
    showResidualValue,
    residualValueCurrency,
    dashboardCpuMetric,
    dashboardBandwidthMetric,
  } = useThemeSettings();
  const siteName = publicInfo?.sitename || "Komari";
  const siteDescription = publicInfo?.description?.trim();
  const mapNodes = useStableMapNodes(nodes);
  const residualValue = useResidualValueSummary(
    nodes,
    showResidualValue && view === "dashboard",
    residualValueCurrency,
  );

  useEffect(() => {
    if (!langOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (
        langMenuRef.current &&
        !langMenuRef.current.contains(e.target as Node)
      ) {
        setLangOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [langOpen]);

  const totalOnline = nodes.filter((n) => n.online).length;
  const totalNodes = nodes.length;

  const totalUsedIn = nodes.reduce((sum, n) => sum + n.bandwidthUsedIn, 0);
  const totalUsedOut = nodes.reduce((sum, n) => sum + n.bandwidthUsedOut, 0);
  const totalBillableUsed = nodes.reduce(
    (sum, n) =>
      sum +
      resolveTrafficUsedGb(
        n.bandwidthUsedIn,
        n.bandwidthUsedOut,
        n.trafficLimitType,
      ),
    0,
  );

  const totalCores = nodes.reduce((sum, n) => sum + n.cpuCores, 0);
  const totalMemory = nodes.reduce((sum, n) => sum + n.memoryTotal, 0);
  const totalDisk = nodes.reduce((sum, n) => sum + n.diskTotal, 0);

  const totalMemoryUsed = nodes.reduce((sum, n) => sum + n.memoryUsed, 0);
  const totalDiskUsed = nodes.reduce((sum, n) => sum + n.diskUsed, 0);

  const avgMemoryPercent = totalMemory > 0 ? (totalMemoryUsed / totalMemory) * 100 : 0;
  const avgDiskPercent = totalDisk > 0 ? (totalDiskUsed / totalDisk) * 100 : 0;

  const onlineNodes = nodes.filter((n) => n.online);
  const avgCpuUsage = onlineNodes.length
    ? onlineNodes.reduce((sum, n) => sum + n.cpuUsage, 0) / onlineNodes.length
    : 0;
  const maxCpuUsage = onlineNodes.length
    ? Math.max(...onlineNodes.map((n) => n.cpuUsage))
    : 0;
  const dashboardCpuUsage =
    dashboardCpuMetric === "Max" ? maxCpuUsage : avgCpuUsage;
  const dashboardCpuLabel =
    dashboardCpuMetric === "Max" ? t.lblCpuMax : t.lblCpuAvg;
  const mobileCpuLabel =
    dashboardCpuMetric === "Max" ? tm.cpuMax : tm.cpuAvg;

  const totalRxSpeed = nodes.reduce((sum, n) => sum + (n.online ? n.netSpeedIn : 0), 0);
  const totalTxSpeed = nodes.reduce((sum, n) => sum + (n.online ? n.netSpeedOut : 0), 0);
  const totalRealtimeSpeed = totalRxSpeed + totalTxSpeed; // in KB/s
  const maxRealtimeSpeed = onlineNodes.length
    ? Math.max(...onlineNodes.map((n) => n.netSpeedIn + n.netSpeedOut))
    : 0;
  const dashboardRealtimeSpeed =
    dashboardBandwidthMetric === "Max" ? maxRealtimeSpeed : totalRealtimeSpeed;
  const dashboardBandwidthLabel =
    dashboardBandwidthMetric === "Max"
      ? t.lblNetworkThroughputMax
      : t.lblNetworkThroughput;
  const mobileBandwidthLabel =
    dashboardBandwidthMetric === "Max"
      ? tm.bandwidthMax
      : tm.bandwidth;

  const isTB = totalBillableUsed >= 1024;
  const formattedBandwidth = isTB
    ? (totalBillableUsed / 1024).toFixed(2)
    : totalBillableUsed.toFixed(1);
  const bandwidthUnit = isTB ? "TB" : "GB";

  // Format speed value and unit separately for the big text metric
  let speedVal = "0.0";
  let speedUnit = "KB/s";
  if (dashboardRealtimeSpeed >= 1024 * 1024) {
    speedVal = (dashboardRealtimeSpeed / (1024 * 1024)).toFixed(2);
    speedUnit = "GB/s";
  } else if (dashboardRealtimeSpeed >= 1024) {
    speedVal = (dashboardRealtimeSpeed / 1024).toFixed(1);
    speedUnit = "MB/s";
  } else {
    speedVal = dashboardRealtimeSpeed.toFixed(0);
    speedUnit = "KB/s";
  }

  // Unique geographic regions — node.flag holds the region code (node.region),
  // whereas node.location is group-first and would miscount.
  const totalRegions = new Set(
    nodes.map((n) => n.flag).filter((f) => f && f !== "🌐"),
  ).size;

  const residualValueLabel = residualValue.loading
    ? "..."
    : formatResidualCurrency(
        residualValue.summary.totalValue,
        residualValue.summary.baseCurrency,
        lang === "zh" ? "zh-CN" : lang,
      );

  const textPrimary = zenText.primary;
  const textMuted = zenText.muted;
  const textUnit = zenText.secondary;
  const btnHoverColor = "hover:text-zen-accent";

  const siteTitleClass = `text-3xl font-black tracking-tight normal-case ${textPrimary} select-none break-words`;
  const renderSiteTitle = () => (
    <Link
      to="/"
      className="inline-flex max-w-full items-center gap-2 text-inherit no-underline decoration-transparent hover:text-inherit focus-visible:outline-none"
    >
      <HeaderLogo
        showLogo={showLogo}
        customLogoUrl={customLogoUrl}
        logoShape={logoShape}
      />
      <span className="min-w-0 break-words">{siteName}</span>
    </Link>
  );

  const adminEntryLink = (className = "") => (
    <a
      href="/admin"
      aria-label={t.controlWorkspace}
      title={t.controlWorkspace}
      className={`inline-flex shrink-0 items-center justify-center ${zenTouch.btn} cursor-pointer transition-colors ${btnHoverColor} ${textPrimary} ${className}`}
    >
      <Settings size={15} strokeWidth={2.25} aria-hidden />
    </a>
  );

  const residualValueButton = ({
    className = "",
    align = "right",
    showInlineLabel = false,
  }: {
    className?: string;
    align?: "left" | "right";
    showInlineLabel?: boolean;
  } = {}) => {
    if (!showResidualValue || view !== "dashboard") return null;
    const alignClass =
      align === "left"
        ? "self-start justify-start text-left"
        : "justify-end text-right";
    return (
      <button
        type="button"
        onClick={() => setResidualOpen(true)}
        className={`inline-flex min-w-0 items-baseline gap-1.5 font-bold ${alignClass} ${textPrimary} hover:text-zen-accent underline-offset-4 hover:underline cursor-pointer ${className}`}
        title={t.residualValueTitle}
      >
        <span className="min-w-0 truncate">{residualValueLabel}</span>
        {showInlineLabel ? (
          <span className={`${zenType.micro} ${textMuted} shrink-0 font-semibold`}>
            {tm.residual}
          </span>
        ) : null}
      </button>
    );
  };

  const settingsControls = (options?: { compact?: boolean }) => {
    const compact = options?.compact ?? false;
    const rootClass = compact
      ? `flex flex-col items-end gap-1.5 font-mono ${zenType.label} tracking-wide ${zenText.subtle}`
      : `flex md:justify-end items-center gap-x-6 gap-y-3 flex-wrap font-mono ${zenType.data} tracking-widest ${zenText.subtle}`;

    return (
      <div className={rootClass}>
        <div className="flex items-center gap-2">
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((open) => !open)}
              className={`cursor-pointer transition-colors hover:text-zen-accent font-bold flex items-center gap-1 ${textPrimary}`}
              aria-expanded={langOpen}
              aria-haspopup="listbox"
            >
              <span>{getLangMenuLabel(lang)}</span>
              <span className={`${zenType.label} opacity-70`}>{langOpen ? "▴" : "▾"}</span>
            </button>
            {langOpen ? (
              <div
                role="listbox"
                className={`absolute right-0 top-full mt-1.5 z-[100] min-w-[9.5rem] py-1 border shadow-lg rounded-sm bg-zen-surface ${zenBorder.muted}`}
              >
                {LANG_MENU_OPTIONS.map((opt) => {
                  const selected = lang === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setLangPreference(opt.value);
                        setLangOpen(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 cursor-pointer transition-colors hover:text-zen-accent ${
                        selected
                          ? `${textPrimary} font-extrabold`
                          : `${zenText.subtle} font-bold`
                      }`}
                    >
                      {opt.label[lang]}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {!compact ? (
            <span className={`${zenText.faint} font-bold block select-none px-1`}>/</span>
          ) : null}
        </div>

        <div className={`flex items-center ${compact ? "gap-1.5 justify-end flex-wrap" : "gap-3"}`}>
          <button
            onClick={() => setThemePreference("auto")}
            className={`cursor-pointer transition-all hover:text-zen-accent font-extrabold ${
              themePreference === "auto"
                ? `${textPrimary} underline underline-offset-4`
                : zenText.subtle
            }`}
          >
            {t.themeAuto}
          </button>
          <span className={zenText.faint}>·</span>
          <button
            onClick={() => setThemePreference("dark")}
            className={`cursor-pointer transition-all hover:text-zen-accent font-extrabold ${
              themePreference === "dark"
                ? `${textPrimary} underline underline-offset-4`
                : zenText.subtle
            }`}
          >
            {t.themeDark}
          </button>
          <span className={zenText.faint}>·</span>
          <button
            onClick={() => setThemePreference("light")}
            className={`cursor-pointer transition-all hover:text-zen-accent font-extrabold ${
              themePreference === "light"
                ? `${textPrimary} underline underline-offset-4`
                : zenText.subtle
            }`}
          >
            {t.themeLight}
          </button>
          <span className={zenText.faint}>·</span>
          {adminEntryLink(compact ? "p-0.5" : "p-1")}
        </div>
      </div>
    );
  };

  return (
    <header className={`font-sans ${zenType.body} uppercase select-none`}>
      {/* 1. Responsive Top Bar with absolute vertical alignment (items-center) */}
      <div className={view === "detail" ? "pb-4 md:pb-5 border-b border-zen-line" : "pb-8 md:pb-10"}>
        <div className="md:hidden space-y-1">
          <h1 className={siteTitleClass}>
            {renderSiteTitle()}
          </h1>
          {siteDescription ? (
            <p className={`${zenType.caption} ${textMuted} font-mono normal-case tracking-wide break-words leading-relaxed`}>
              {siteDescription}
            </p>
          ) : null}
        </div>

        <div
          className={`md:hidden flex items-start justify-between gap-4 mt-3 ${langOpen ? "relative z-50" : ""}`}
        >
          <LocalClock
            label={t.localTime}
            loadingLabel={t.loading}
            textMuted={textMuted}
            textPrimary={textPrimary}
            compact
            className="flex min-w-0 flex-1 flex-col text-left font-mono"
          />
          <div className="shrink-0 pt-0.5">{settingsControls({ compact: true })}</div>
        </div>

        <div className="hidden md:grid md:grid-cols-3 gap-6 items-center">
        {/* Left: App Logo/Branding (Single Word KOMARI) */}
        <div className="text-left min-w-0">
          <h1 className={siteTitleClass}>
            {renderSiteTitle()}
          </h1>
          {siteDescription ? (
            <p className={`${zenType.caption} mt-1 max-w-md ${textMuted} font-mono normal-case tracking-wide break-words leading-relaxed`}>
              {siteDescription}
            </p>
          ) : null}
        </div>

        {/* Middle: Local timezone clock */}
        <LocalClock
          label={t.localTime}
          loadingLabel={t.loading}
          textMuted={textMuted}
          textPrimary={textPrimary}
          className="flex flex-col items-center text-center font-mono"
        />

        {/* Right: Modern Menu Controls (with localized Dark/Light options) */}
        <div className={langOpen ? "relative z-50" : ""}>{settingsControls()}</div>
        </div>
      </div>

      {/* 2. RESTRUCTURED HIGH-DENSITY BALANCED TELEMETRY CHANNELS */}
      {view !== "detail" && (
        <>
          {/* Mobile: three hero metrics in one row */}
          <div className="grid grid-cols-3 gap-1.5 pt-6 md:hidden">
            <MobileMetricHero
              label={tm.nodeStatus}
              value={String(totalOnline)}
              suffix={` / ${totalNodes}`}
              textMuted={textMuted}
              textPrimary={textPrimary}
              textUnit={textUnit}
            />
            <MobileMetricHero
              label={mobileCpuLabel}
              value={dashboardCpuUsage.toFixed(1)}
              suffix="%"
              textMuted={textMuted}
              textPrimary={textPrimary}
              textUnit={textUnit}
            />
            <MobileMetricHero
              label={mobileBandwidthLabel}
              value={speedVal}
              suffix={speedUnit}
              textMuted={textMuted}
              textPrimary={textPrimary}
              textUnit={textUnit}
            />
          </div>

          {/* Mobile: detail rows stacked */}
          <div
            className={`md:hidden pt-4 ${zenType.data} font-mono leading-relaxed tracking-wider divide-y divide-zen-line`}
          >
            {/* Traffic totals — horizontal row */}
            <div className="grid grid-cols-3 gap-1.5 pb-3 text-center">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span className={`${textMuted} leading-tight`}>{tm.traffic}</span>
                <span className={`font-bold ${textPrimary}`}>
                  {formattedBandwidth} {bandwidthUnit}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span className={`${textMuted} leading-tight`}>{tm.rx}</span>
                <span className={`font-bold ${textPrimary}`}>{formatTrafficGb(totalUsedIn)}</span>
              </div>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span className={`${textMuted} leading-tight`}>{tm.tx}</span>
                <span className={`font-bold ${textPrimary}`}>{formatTrafficGb(totalUsedOut)}</span>
              </div>
            </div>
            {/* Overview list */}
            <div className="space-y-1.5 pt-3">
            <div className="flex justify-between gap-3 py-0.5">
              <span className={`${textMuted} shrink-0`}>{tm.regions}:</span>
              <span className="flex min-w-0 items-center justify-end gap-2 text-right">
                <span className={`font-bold ${textPrimary}`}>{totalRegions}</span>
                {showResidualValue ? (
                  <>
                    <span className={zenText.faint}>/</span>
                    {residualValueButton({
                      className: "max-w-[min(13rem,64vw)]",
                      showInlineLabel: true,
                    })}
                  </>
                ) : null}
              </span>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <span className={`${textMuted} shrink-0`}>{t.lblCores}:</span>
              <span className={`font-bold text-right ${textPrimary}`}>
                {totalCores} {tm.threads}
              </span>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <span className={`${textMuted} shrink-0`}>{t.lblMemory}:</span>
              <span className={`font-bold text-right ${textPrimary}`}>
                {formatResourceUsageSummary(
                  totalMemoryUsed,
                  totalMemory,
                  avgMemoryPercent,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <span className={`${textMuted} shrink-0`}>{t.lblDisk}:</span>
              <span className={`font-bold text-right ${textPrimary}`}>
                {formatResourceUsageSummary(
                  totalDiskUsed,
                  totalDisk,
                  avgDiskPercent,
                  { usedDigits: 0, totalDigits: 0 },
                )}
              </span>
            </div>
            {showNodeMap ? (
              <>
                <button
                  type="button"
                  id="mobile-node-map-toggle"
                  aria-expanded={mapExpanded}
                  aria-controls="mobile-node-map-panel"
                  onClick={() => setMapExpanded((open) => !open)}
                  className={`flex w-full justify-between gap-3 py-0.5 items-center ${zenTouch.btn} cursor-pointer`}
                >
                  <span className={`${textMuted} shrink-0`}>
                    {t.lblNodeDistribution}:
                  </span>
                  <span
                    className={`flex items-center gap-1.5 font-bold text-right ${textPrimary}`}
                  >
                    <span
                      className={`${zenType.caption} font-normal normal-case ${textMuted}`}
                    >
                      {mapExpanded ? t.mapScrollHint : t.mapExpandHint}
                    </span>
                    <span className={`${zenType.caption} ${textMuted}`} aria-hidden>
                      {mapExpanded ? "▴" : "▾"}
                    </span>
                  </span>
                </button>
                {mapExpanded ? (
                  <div id="mobile-node-map-panel" className="pt-2 pb-1 -mx-4">
                    <Suspense fallback={null}>
                      <NodeDistributionMap
                        nodes={mapNodes}
                        theme={theme}
                        lang={lang}
                        hideHeader
                        embedded
                      />
                    </Suspense>
                  </div>
                ) : null}
              </>
            ) : null}
            </div>
          </div>

          {/* Desktop: three columns with hero + details each */}
          <div className="hidden md:grid md:grid-cols-3 gap-8 pt-8 md:pt-10">
          {/* Metric 1: Cluster Nodes Status */}
          <div className="flex flex-col justify-start space-y-4">
            <div className="flex items-center gap-3">
              <span className={`${zenType.section} zen-track-tight ${textMuted} font-mono uppercase shrink-0`}>
                {t.lblClusterNodeStatus}
              </span>
              <span className="h-px flex-1 bg-zen-line" aria-hidden />
            </div>
            <div className="space-y-3">
              <div className="h-14 sm:h-16 md:h-20 lg:h-24 flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-1 md:gap-2 min-w-0">
                  <span className={`text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] xl:text-[5.5rem] font-black ${textPrimary} tracking-tighter leading-none`}>
                    {totalOnline}
                  </span>
                  <span className={`text-xl sm:text-2xl md:text-3xl lg:text-[2.25rem] ${textUnit} font-light font-sans select-none pb-0.5`}>
                    / {totalNodes}
                  </span>
                </div>
                {showNodeMap && view === "dashboard" ? (
                  <button
                    type="button"
                    aria-label={t.lblNodeDistribution}
                    title={t.lblNodeDistribution}
                    onClick={() => setMapOpen(true)}
                    className={`hidden md:inline-flex shrink-0 items-center justify-center self-end rounded-full border border-zen-border-muted bg-zen-elevate/30 p-2.5 mb-1 ${zenText.muted} hover:border-zen-accent/40 hover:text-zen-accent ${zenTouch.btn} ${zenMotion.pop} cursor-pointer`}
                  >
                    <Globe size={22} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Metric 2: CPU usage across online nodes */}
          <div className="flex flex-col justify-start space-y-4 md:border-l md:border-zen-line md:pl-8 lg:pl-12">
            <div className="flex items-center gap-3">
              <span className={`${zenType.section} zen-track-tight ${textMuted} font-mono uppercase shrink-0`}>
                {dashboardCpuLabel}
              </span>
              <span className="h-px flex-1 bg-zen-line" aria-hidden />
            </div>
            <div className="space-y-3">
              <div className="h-14 sm:h-16 md:h-20 lg:h-24 flex items-end">
                <div className="flex items-baseline gap-1 md:gap-2 select-none">
                  <span className={`text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] xl:text-[5.5rem] font-black ${textPrimary} tracking-tighter leading-none`}>
                    {dashboardCpuUsage.toFixed(1)}
                  </span>
                  <span className={`text-xl sm:text-2xl md:text-3xl lg:text-[2.25rem] ${textUnit} font-medium font-mono select-none pb-0.5`}>
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Metric 3: Global Networks & Rates */}
          <div className="flex flex-col justify-start space-y-4 md:border-l md:border-zen-line md:pl-8 lg:pl-12">
            <div className="flex items-center gap-3">
              <span className={`${zenType.section} zen-track-tight ${textMuted} font-mono uppercase shrink-0`}>
                {dashboardBandwidthLabel}
              </span>
              <span className="h-px flex-1 bg-zen-line" aria-hidden />
            </div>
            <div className="space-y-3">
              <div className="h-14 sm:h-16 md:h-20 lg:h-24 flex items-end">
                <div className="flex items-baseline gap-1 md:gap-2 select-none">
                  <span className={`text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] xl:text-[5.5rem] font-black ${textPrimary} tracking-tighter leading-none`}>
                    {speedVal}
                  </span>
                  <span className={`text-xl sm:text-2xl md:text-3xl lg:text-[2.25rem] ${textUnit} font-black font-mono select-none pb-0.5`}>
                    {speedUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Unified supplementary stats — aligned matrix below the heroes */}
          <div className="hidden md:grid md:grid-cols-4 pt-7 mt-1 border-t border-zen-line font-mono [&>*]:border-zen-line [&>*]:px-5 [&>*]:py-3 [&>*:nth-child(4n+1)]:pl-0 [&>*:nth-child(4n)]:pr-0 [&>*:not(:nth-child(4n+1))]:border-l [&>*:nth-child(n+5)]:border-t">
            {showResidualValue ? (
              <div className="flex flex-col gap-1">
                <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.residualValueTitle}</span>
                {residualValueButton({
                  className: `${zenType.data}`,
                  align: "left",
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblOfflineNodes}</span>
                <span className={`${zenType.data} font-bold ${totalNodes - totalOnline > 0 ? "text-red-500" : textPrimary}`}>{totalNodes - totalOnline}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblTotalRegions}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>{totalRegions}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblCores}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>{totalCores} {t.lblThreads}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblMemory}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>
                {formatResourceUsageSummary(
                  totalMemoryUsed,
                  totalMemory,
                  avgMemoryPercent,
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblDisk}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>
                {formatResourceUsageSummary(
                  totalDiskUsed,
                  totalDisk,
                  avgDiskPercent,
                  { usedDigits: 0, totalDigits: 0 },
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.cumulativeBandwidth}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>{formattedBandwidth} {bandwidthUnit}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblInboundRxShort || "RX"}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>{formatTrafficGb(totalUsedIn)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${zenType.label} zen-track-tight uppercase ${textMuted}`}>{t.lblOutboundTxShort || "TX"}</span>
              <span className={`${zenType.data} font-bold ${textPrimary}`}>{formatTrafficGb(totalUsedOut)}</span>
            </div>
          </div>
        </>
      )}

      {showNodeMap && view === "dashboard" ? (
        <NodeDistributionMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          nodes={mapNodes}
          theme={theme}
          lang={lang}
        />
      ) : null}
      {showResidualValue && view === "dashboard" ? (
        <ResidualValueModal
          open={residualOpen}
          onClose={() => setResidualOpen(false)}
          summary={residualValue.summary}
          exchangeRates={residualValue.exchangeRates}
          loading={residualValue.loading}
          error={residualValue.error}
          lang={lang}
        />
      ) : null}
    </header>
  );
}

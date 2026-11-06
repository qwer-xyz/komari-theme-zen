/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useDeferredValue,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, LayoutGrid, Search, Table2, X } from "lucide-react";
import { VPSNode } from "../types";
import { translations, Lang, formatMsg } from "../lib/i18n";
import {
  formatKbps,
  formatNodeTraffic,
  formatUptime,
  getTrafficTypeShortLabel,
  type TrafficLimitType,
} from "@/lib/formatUnits";
import {
  formatBillingCycleSuffix,
  formatNodeBilling,
  formatPricePart,
  shouldShowAutoRenewalBadge,
  type BillingLabels,
} from "@/lib/billingDisplay";
import {
  ALL_NODE_GROUP,
  OFFLINE_NODE_GROUP,
  allGroupsLabel,
  collectNodeGroups,
} from "@/lib/nodeGroups";
import {
  NODE_SORT_FIELD_MAP,
  sortNodeList,
  type NodeSortField,
  type NodeSortOrder,
} from "@/lib/nodeSort";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useViewMode } from "@/hooks/useViewMode";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import { useCollectionTransition } from "@/hooks/useCollectionTransition";
import { Flag } from "@/components/Flag";
import { OsIcon } from "@/components/OsIcon";
import { NodeTags } from "@/components/NodeTags";
import { PublicRemarkButton } from "@/components/PublicRemarkButton";
import { LatencyHistoryBlocks } from "@/components/LatencyHistoryBlocks";
import { LatencyProbeModal } from "@/components/LatencyProbeModal";
import { MetricPercentBar } from "@/components/MetricSegmentBar";
import { UIState } from "@/components/UIState";
import {
  type LatencyColorConfig,
  metricPercentFillClass,
} from "@/lib/latencyDisplay";
import { zenType, zenTouch } from "@/lib/typography";
import {
  zenBorder,
  zenControl,
  zenFill,
  zenInteractive,
  zenText,
} from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";
import { ZenTabControl } from "@/components/motion/ZenTabControl";
import { safePercent } from "@/lib/numeric";

type NodeItemProps = {
  node: VPSNode;
  lang: Lang;
  theme: "light" | "dark";
  latencyVisible: boolean;
  showExpiryTime: boolean;
  latencyColorConfig: LatencyColorConfig;
  handleNodeContainerClick: (event: React.MouseEvent, node: VPSNode) => void;
  openLatencyModal: (node: VPSNode) => void;
  renderTableBilling: (node: VPSNode) => React.ReactNode;
  shouldShowBillingBadge: (node: VPSNode) => boolean;
  renderBillingWithAutoRenewal: (
    node: VPSNode,
    compact?: boolean,
  ) => React.ReactNode;
};
const textPrimary = zenText.primary;
const textMuted = zenText.muted;
const formatSpeed = (kbps: number) => formatKbps(kbps);
const renderTrafficValue = (node: VPSNode) => (
  <span className="inline-flex items-center gap-1.5 min-w-0">
    <span className="truncate">{formatNodeTraffic(node)}</span>
    {node.bandwidthTotal <= 0 ? (
      <span
        className={`inline-flex shrink-0 px-1 py-px rounded-sm border ${zenType.micro} font-medium tracking-wide leading-none ${unlimitedTrafficBadgeClass}`}
      >
        <span className={unlimitedTrafficSymbolClass}>∞</span>
      </span>
    ) : (
      <span
        className={`inline-flex shrink-0 px-1 py-px rounded-sm border ${zenType.micro} font-medium tracking-wide leading-none ${trafficTypeBadgeClass(node.trafficLimitType)}`}
      >
        {getTrafficTypeShortLabel(node.trafficLimitType)}
      </span>
    )}
  </span>
);

function NodeUptime({
  node,
  lang,
  className,
}: {
  node: VPSNode;
  lang: Lang;
  className?: string;
}) {
  const t = translations[lang];
  const labels = {
    day: t.unitDay,
    hour: t.unitHour,
    minute: t.unitMin,
    second: t.unitSec,
  };
  const hasUptime = node.status === "online" && node.uptimeSec > 0;
  return (
    <span
      className={`font-mono tabular-nums ${className ?? ""}`}
      title={
        hasUptime
          ? `${t.lblUptimeSec} ${formatUptime(node.uptimeSec, labels)}`
          : undefined
      }
    >
      {hasUptime
        ? formatUptime(
            node.uptimeSec,
            { ...labels, hour: t.unitHourShort },
            "compact",
          )
        : "—"}
    </span>
  );
}

const NodeListRow = React.memo(function NodeListRow({
  node,
  lang,
  theme,
  latencyVisible,
  showExpiryTime,
  latencyColorConfig,
  handleNodeContainerClick,
  openLatencyModal,
  renderTableBilling,
  shouldShowBillingBadge,
  renderBillingWithAutoRenewal,
}: NodeItemProps) {
  const t = translations[lang];
  const openLatency = useCallback(
    () => openLatencyModal(node),
    [openLatencyModal, node],
  );

  const cpuColor =
    node.cpuUsage > 75
      ? "text-zen-danger font-medium"
      : node.cpuUsage > 40
        ? "text-zen-warning font-medium"
        : textPrimary;

  const memPercent = safePercent(node.memoryUsed, node.memoryTotal);
  const memColor =
    memPercent > 80
      ? "text-zen-danger font-medium"
      : memPercent > 50
        ? "text-zen-warning font-medium"
        : textPrimary;

  const diskPercent = safePercent(node.diskUsed, node.diskTotal);
  const diskColor =
    diskPercent > 80
      ? "text-zen-danger font-medium"
      : diskPercent > 50
        ? "text-zen-warning font-medium"
        : textPrimary;

  return (
    <tr
      key={node.id}
      onClick={(event) => handleNodeContainerClick(event, node)}
      className={`km-ui-table-row cursor-pointer group border-b border-zen-line hover:bg-zen-elevate transition-[background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        node.status === "offline"
          ? "bg-zen-fill-muted/10 text-zen-fg-muted"
          : node.status === "unknown"
            ? "bg-zen-warning/[0.04]"
            : ""
      }`}
    >
      {/* Identification */}
      <td className={`py-3 px-2 font-sans font-semibold ${textPrimary}`}>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Flag flag={node.flag} className="w-4 h-4 shrink-0" />
            <Link
              to={`/instance/${encodeURIComponent(node.id)}`}
              state={{ fromDashboard: true }}
              className="min-w-0 flex-1 truncate max-w-[240px] md:max-w-[200px] hover:text-zen-accent hover:underline underline-offset-2"
              title={node.name}
            >
              {node.name}
            </Link>
            {node.status !== "online" ? (
              <span
                className={`shrink-0 rounded border px-1 py-px ${zenType.micro} font-medium ${
                  node.status === "unknown"
                    ? "border-zen-warning/40 text-zen-warning"
                    : "border-zen-border-muted text-zen-fg-muted"
                }`}
              >
                {node.status === "unknown"
                  ? t.statusUnknown
                  : t.connectionOffline}
              </span>
            ) : null}
            <PublicRemarkButton
              publicRemark={node.publicRemark}
              privateRemark={node.privateRemark}
              theme={theme}
              publicLabel={t.publicRemark}
              privateLabel={t.privateRemark}
              className="shrink-0 ml-auto"
            />
          </div>
          <NodeTags tags={node.tags} theme={theme} size="sm" maxVisible={2} />
        </div>
      </td>

      {/* OS Specific */}
      <td
        className={`py-3 px-2 ${textMuted} ${zenType.data} whitespace-nowrap`}
      >
        <div className="flex flex-col gap-1">
          {(() => {
            const osDetails = getOSDetails(node.os, node.arch);
            return (
              <span className="flex items-center gap-2 inline-flex">
                <OsIcon os={node.os} />
                <span>{osDetails.text}</span>
              </span>
            );
          })()}
          <span className={`${zenType.caption} ${zenText.subtle} normal-case`}>
            {t.uptime}:{" "}
            <NodeUptime node={node} lang={lang} />
          </span>
        </div>
      </td>

      {/* CPU Live Load */}
      <td className="py-3 px-2">
        {node.online ? (
          <MetricAsciiBar
            percent={node.cpuUsage}
            colorClass={cpuColor}
            textPrimaryClass={textPrimary}
          />
        ) : (
          "---"
        )}
      </td>

      {/* Memory Usage */}
      <td className="py-3 px-2">
        {node.online ? (
          <MetricAsciiBar
            percent={memPercent}
            colorClass={memColor}
            textPrimaryClass={textPrimary}
          />
        ) : (
          "---"
        )}
      </td>

      {/* Root Disk Usage */}
      <td className={`py-3 px-2`}>
        {node.online ? (
          <MetricAsciiBar
            percent={diskPercent}
            colorClass={diskColor}
            textPrimaryClass={textPrimary}
          />
        ) : (
          "---"
        )}
      </td>

      {/* Ping Latency */}
      {latencyVisible && (
        <td className="py-3 px-2">
          {node.online && node.latency > 0 ? (
            <LatencyHistoryBlocks
              samples={node.latencyHistory}
              currentMs={node.latency}
              theme={theme}
              textPrimary={textPrimary}
              colorConfig={latencyColorConfig}
              historyLabel={t.latencyHistoryAria}
              onValueClick={openLatency}
            />
          ) : (
            <span className={textMuted}>—</span>
          )}
        </td>
      )}

      {/* Bandwidth Speed */}
      <td className="py-3 px-2">
        {node.online ? (
          <span
            className={`inline-flex items-baseline gap-x-2 font-medium ${textPrimary}`}
          >
            <span>↓ {formatSpeed(node.netSpeedIn)}</span>
            <span>↑ {formatSpeed(node.netSpeedOut)}</span>
          </span>
        ) : (
          "---"
        )}
      </td>

      {/* Traffic Quantity */}
      <td className="py-3 px-2">
        {node.online ? (
          <span className={`font-medium ${textPrimary}`}>
            {renderTrafficValue(node)}
          </span>
        ) : (
          "---"
        )}
      </td>

      {showExpiryTime && (
        <td className={`py-3 px-2 ${zenType.data} font-medium`}>
          {renderTableBilling(node)}
        </td>
      )}
    </tr>
  );
});
const NodeCard = React.memo(function NodeCard({
  node,
  lang,
  theme,
  latencyVisible,
  showExpiryTime,
  latencyColorConfig,
  handleNodeContainerClick,
  openLatencyModal,
  renderTableBilling,
  shouldShowBillingBadge,
  renderBillingWithAutoRenewal,
}: NodeItemProps) {
  const t = translations[lang];
  const openLatency = useCallback(
    () => openLatencyModal(node),
    [openLatencyModal, node],
  );

  const cpuColor =
    node.cpuUsage > 75
      ? "text-zen-danger font-medium"
      : node.cpuUsage > 40
        ? "text-zen-warning font-medium"
        : textPrimary;

  const memPercent = safePercent(node.memoryUsed, node.memoryTotal);
  const memColor =
    memPercent > 80
      ? "text-zen-danger font-medium"
      : memPercent > 50
        ? "text-zen-warning font-medium"
        : textPrimary;

  const diskPercent = safePercent(node.diskUsed, node.diskTotal);
  const diskColor =
    diskPercent > 80
      ? "text-zen-danger font-medium"
      : diskPercent > 50
        ? "text-zen-warning font-medium"
        : textPrimary;

  return (
    <article
      key={node.id}
      onClick={(event) => handleNodeContainerClick(event, node)}
      className={`km-node-card cursor-pointer group flex flex-col gap-3 p-4 sm:p-5 border border-zen-line bg-zen-elevate hover:border-zen-line-strong [content-visibility:auto] [contain-intrinsic-size:auto_320px] ${zenMotion.card} ${
        node.status === "offline"
          ? "bg-zen-fill-muted/10 text-zen-fg-muted"
          : node.status === "unknown"
            ? "border-zen-warning/35 bg-zen-warning/[0.04]"
            : ""
      }`}
    >
      {/* Card header：标签与标题同一行，不额外占高 */}
      <div className="flex items-center gap-2 min-w-0">
        <Flag flag={node.flag} className="w-5 h-5 shrink-0" />
        <h4
          className={`min-w-0 flex-1 truncate font-sans ${zenType.body} font-semibold tracking-normal ${textPrimary}`}
          title={node.name}
        >
          <Link
            to={`/instance/${encodeURIComponent(node.id)}`}
            state={{ fromDashboard: true }}
            className="hover:text-zen-accent hover:underline underline-offset-2"
          >
            {node.name}
          </Link>
        </h4>
        {node.status !== "online" ? (
          <span
            className={`shrink-0 rounded border px-1 py-px ${zenType.micro} font-medium ${
              node.status === "unknown"
                ? "border-zen-warning/40 text-zen-warning"
                : "border-zen-border-muted text-zen-fg-muted"
            }`}
          >
            {node.status === "unknown" ? t.statusUnknown : t.connectionOffline}
          </span>
        ) : null}
        <NodeTags
          tags={node.tags}
          theme={theme}
          size="sm"
          maxVisible={2}
          className="shrink-0"
        />
        <PublicRemarkButton
          publicRemark={node.publicRemark}
          privateRemark={node.privateRemark}
          theme={theme}
          publicLabel={t.publicRemark}
          privateLabel={t.privateRemark}
          className="shrink-0"
        />
      </div>

      {/* Fully Localized pure text metric layout with pure language alignment */}
      <div
        className={`space-y-2 font-sans ${zenType.data} leading-relaxed ${textMuted}`}
      >
        <div className="flex justify-between">
          <span>{t.os}:</span>
          <span className={`font-medium ${textPrimary} flex items-center gap-2`}>
            {(() => {
              const osDetails = getOSDetails(node.os, node.arch);
              return (
                <>
                  <OsIcon os={node.os} />
                  <span>{osDetails.text}</span>
                </>
              );
            })()}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0">{t.uptime}:</span>
          <NodeUptime
            node={node}
            lang={lang}
            className={`min-w-0 text-right font-medium tabular-nums ${textPrimary}`}
          />
        </div>
        <div className="flex justify-between">
          <span>{t.cpu}:</span>
          {node.online ? (
            <MetricAsciiBar
              percent={node.cpuUsage}
              colorClass={cpuColor}
              textPrimaryClass={textPrimary}
            />
          ) : (
            <span>---</span>
          )}
        </div>
        <div className="flex justify-between">
          <span>{t.mem}:</span>
          {node.online ? (
            <MetricAsciiBar
              percent={memPercent}
              colorClass={memColor}
              textPrimaryClass={textPrimary}
            />
          ) : (
            <span>---</span>
          )}
        </div>
        <div className="flex justify-between">
          <span>{t.diskspace}:</span>
          {node.online ? (
            <MetricAsciiBar
              percent={diskPercent}
              colorClass={diskColor}
              textPrimaryClass={textPrimary}
            />
          ) : (
            <span>---</span>
          )}
        </div>
        {latencyVisible && (
          <div className="flex justify-between">
            <span>{t.ping}:</span>
            {node.online && node.latency > 0 ? (
              <LatencyHistoryBlocks
                samples={node.latencyHistory}
                currentMs={node.latency}
                theme={theme}
                textPrimary={textPrimary}
                colorConfig={latencyColorConfig}
                historyLabel={t.latencyHistoryAria}
                onValueClick={openLatency}
              />
            ) : (
              <span>—</span>
            )}
          </div>
        )}
        <div className="flex justify-between">
          <span>{t.bandwidth}:</span>
          {node.online ? (
            <span
              className={`inline-flex items-baseline gap-x-2 font-medium ${textPrimary}`}
            >
              <span>↓ {formatSpeed(node.netSpeedIn)}</span>
              <span>↑ {formatSpeed(node.netSpeedOut)}</span>
            </span>
          ) : (
            <span>---</span>
          )}
        </div>
        <div className="flex justify-between gap-2">
          <span className="shrink-0">{t.traffic}:</span>
          {node.online ? (
            <span className={`font-medium ${textPrimary} min-w-0 text-right`}>
              {renderTrafficValue(node)}
            </span>
          ) : (
            <span>---</span>
          )}
        </div>
        {showExpiryTime && (
          <div className="flex justify-between gap-2">
            <span className="shrink-0">
              {shouldShowBillingBadge(node) ? t.autoRenewal : t.expiry}:
            </span>
            <span className="min-w-0 text-right">
              {renderBillingWithAutoRenewal(node, true)}
            </span>
          </div>
        )}
      </div>
    </article>
  );
});

interface NodeTableProps {
  nodes: VPSNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: VPSNode) => void;
  lang: Lang;
  theme: "light" | "dark";
}

type SortField = NodeSortField;
type SortOrder = NodeSortOrder;

const SORT_FIELD_MAP = NODE_SORT_FIELD_MAP;

function trafficTypeBadgeClass(type: TrafficLimitType | undefined): string {
  switch (type ?? "sum") {
    case "max":
      return "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:border-rose-300/25 dark:bg-rose-300/12 dark:text-rose-300";
    case "min":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-300";
    case "up":
      return "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:border-amber-300/25 dark:bg-amber-300/12 dark:text-amber-300";
    case "down":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300/25 dark:bg-cyan-300/12 dark:text-cyan-300";
    case "sum":
    default:
      return "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:border-blue-300/25 dark:bg-blue-300/12 dark:text-blue-300";
  }
}

const unlimitedTrafficBadgeClass =
  "border-zen-accent/35 bg-zen-accent/12 text-zen-accent";
const unlimitedTrafficSymbolClass =
  "inline-block scale-[1.45] leading-none tracking-normal";

function getOSDetails(os: string, arch: string) {
  const upperOS = os.toUpperCase();
  let osKey = "";
  if (upperOS.includes("DEBIAN")) {
    osKey = "DEBIAN";
  } else if (upperOS.includes("UBUNTU")) {
    osKey = "UBUNTU";
  } else if (upperOS.includes("CENTOS")) {
    osKey = "CENTOS";
  } else if (upperOS.includes("ALPINE")) {
    osKey = "ALPINE";
  } else if (upperOS.includes("ROCKY")) {
    osKey = "ROCKY";
  } else if (upperOS.includes("ORACLE")) {
    osKey = "ORACLE";
  } else if (upperOS.includes("REDHAT") || upperOS.includes("RHEL")) {
    osKey = "RHEL";
  } else if (upperOS.includes("WINDOWS")) {
    osKey = "WINDOWS";
  } else if (upperOS.includes("MACOS")) {
    osKey = "MACOS";
  } else {
    osKey = os.split(/[\s,._-]+/)[0].toUpperCase();
    if (!osKey) osKey = "LINUX";
  }

  let archKey = arch.toUpperCase();
  if (archKey === "AARCH64") archKey = "ARM64";
  if (archKey === "X86_64") archKey = "AMD64";

  return { text: `${osKey} ${archKey}` };
}

function MetricAsciiBar({
  percent,
  colorClass,
  textPrimaryClass,
}: {
  percent: number;
  colorClass: string;
  textPrimaryClass: string;
}) {
  return (
    <MetricPercentBar
      percent={percent}
      valueClassName={colorClass}
      fillClassName={metricPercentFillClass(colorClass)}
      textPrimaryClass={textPrimaryClass}
    />
  );
}

export function NodeTable({
  nodes,
  selectedNodeId,
  onSelectNode,
  lang,
  theme,
}: NodeTableProps) {
  const t = translations[lang];
  const {
    showExpiryTime,
    showAutoRenewal,
    showOfflineGroup,
    offlineServerPosition,
    defaultViewMode,
    defaultSortField,
    defaultSortOrder,
    showLatency,
    latencyColorConfig,
  } = useThemeSettings();
  const { recordEnabled } = useRecordSettings();
  const latencyVisible =
    showLatency && (recordEnabled || nodes.some((node) => node.latency > 0));
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeDisplayRef = useRef<HTMLDivElement>(null);
  const routeGroup = (searchParams.get("group") ?? "").trim();
  const routeSearch = searchParams.get("q") ?? "";
  const routeSort = searchParams.get("sort") as SortField | null;
  const routeOrder = searchParams.get("order") as SortOrder | null;

  const mappedDefaultSort = SORT_FIELD_MAP[defaultSortField] ?? "default";
  const validSortFields = new Set<SortField>([
    "default",
    "status",
    "name",
    "os",
    "cpu",
    "mem",
    "disk",
    "bandwidth",
    "traffic",
    "latency",
    "days",
  ]);
  const requestedSort =
    routeSort && validSortFields.has(routeSort) ? routeSort : mappedDefaultSort;
  const initialSortField: SortField =
    (requestedSort === "latency" && !latencyVisible) ||
    (requestedSort === "days" && !showExpiryTime)
      ? "default"
      : requestedSort;
  const initialSortOrder: SortOrder =
    routeOrder === "asc" || routeOrder === "desc"
      ? routeOrder
      : defaultSortOrder === "Descending"
        ? "desc"
        : "asc";

  const [activeGroup, setActiveGroup] = useState<string>(
    () => routeGroup || ALL_NODE_GROUP,
  );
  const [latencyModalNode, setLatencyModalNode] = useState<VPSNode | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState<string>(routeSearch);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const sortField = initialSortField;
  const sortOrder = initialSortOrder;
  const [openSortMenu, setOpenSortMenu] = useState<"mobile" | "desktop" | null>(
    null,
  );
  const sortMenuIdPrefix = React.useId();
  const mobileSortMenuRef = useRef<HTMLDivElement>(null);
  const desktopSortMenuRef = useRef<HTMLDivElement>(null);
  const mobileSortMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopSortMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const searchEditedRef = React.useRef(false);
  const mobileFilterRef = useRef<HTMLDetailsElement>(null);
  const groupScrollRef = useRef<HTMLDivElement>(null);
  const [groupScrollFade, setGroupScrollFade] = useState({
    left: false,
    right: false,
  });

  const refreshGroupScrollFade = useCallback(() => {
    const scroller = groupScrollRef.current;
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    const edge = 4;
    setGroupScrollFade({
      left: scrollLeft > edge,
      right: scrollLeft + clientWidth < scrollWidth - edge,
    });
  }, []);

  const { effectiveViewMode, setViewMode } =
    useViewMode(defaultViewMode);

  useLayoutEffect(() => {
    if (!openSortMenu) return;
    const menuRef =
      openSortMenu === "mobile" ? mobileSortMenuRef : desktopSortMenuRef;
    const triggerRef = openSortMenu === "mobile" ? mobileSortMenuTriggerRef : desktopSortMenuTriggerRef;
    const placeMenu = () => {
      const menu = menuRef.current;
      const trigger = triggerRef.current;
      if (!menu || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < Math.min(menu.scrollHeight, 300) && above > below;
      menu.style.maxHeight = `${Math.max(100, Math.min(480, upward ? above : below))}px`;
      menu.style.top = upward ? "auto" : "100%";
      menu.style.bottom = upward ? "calc(100% + 4px)" : "auto";
      menu.style.marginTop = upward ? "0" : "4px";
    };
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    const frame = window.requestAnimationFrame(() => {
      const current = menuRef.current?.querySelector<HTMLElement>(
        '[aria-checked="true"]',
      );
      const first = menuRef.current?.querySelector<HTMLElement>("button");
      (current ?? first)?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [openSortMenu]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnBreakpointChange = () => setOpenSortMenu(null);
    media.addEventListener("change", closeOnBreakpointChange);
    return () => media.removeEventListener("change", closeOnBreakpointChange);
  }, []);

  const updateGroupSearchParam = useCallback(
    (group: string, replace = false) => {
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          nextParams.delete("page");
          if (group === ALL_NODE_GROUP) {
            nextParams.delete("group");
          } else {
            nextParams.set("group", group);
          }
          return nextParams;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const handleGroupChange = useCallback(
    (group: string) => {
      setActiveGroup(group);
      updateGroupSearchParam(group);
    },
    [updateGroupSearchParam],
  );

  const getFieldLabel = (field: SortField) => {
    switch (field) {
      case "default":
        return t.sortDefault;
      case "status":
        return t.status;
      case "name":
        return t.name;
      case "os":
        return t.os;
      case "cpu":
        return t.cpu;
      case "mem":
        return t.mem;
      case "disk":
        return t.disk;
      case "bandwidth":
        return t.bandwidth;
      case "traffic":
        return t.traffic;
      case "latency":
        return t.ping;
      case "days":
        return t.expiry;
      default:
        return String(field).toUpperCase();
    }
  };

  const sortOptions: { value: SortField; label: string }[] = [
    { value: "default", label: t.sortDefault },
    { value: "name", label: t.name },
    { value: "cpu", label: t.cpu },
    { value: "mem", label: t.mem },
    { value: "disk", label: t.disk },
    { value: "bandwidth", label: t.bandwidth },
    { value: "traffic", label: t.traffic },
    ...(latencyVisible
      ? [{ value: "latency" as SortField, label: t.ping }]
      : []),
    ...(showExpiryTime
      ? [{ value: "days" as SortField, label: t.expiry }]
      : []),
    { value: "os", label: t.os },
    { value: "status", label: t.status },
  ];

  const billingLabels: BillingLabels = useMemo(
    () => ({
      unitDays: t.unitDays,
      billingFree: t.billingFree,
      billingExpired: t.billingExpired,
      billingLongTerm: t.billingLongTerm,
      billingNoInfo: t.billingNoInfo,
      billingHidden: t.billingHidden,
      billingNotSet: t.billingNotSet,
      billingMonthly: t.billingMonthly,
      billingQuarterly: t.billingQuarterly,
      billingSemiAnnual: t.billingSemiAnnual,
      billingAnnual: t.billingAnnual,
      billingBiennial: t.billingBiennial,
      billingTriennial: t.billingTriennial,
      billingQuinquennial: t.billingQuinquennial,
      billingOnce: t.billingOnce,
      billingCycleDays: t.billingCycleDays,
    }),
    [
      t.unitDays,
      t.billingFree,
      t.billingExpired,
      t.billingLongTerm,
      t.billingNoInfo,
      t.billingHidden,
      t.billingNotSet,
      t.billingMonthly,
      t.billingQuarterly,
      t.billingSemiAnnual,
      t.billingAnnual,
      t.billingBiennial,
      t.billingTriennial,
      t.billingQuinquennial,
      t.billingOnce,
      t.billingCycleDays,
    ],
  );

  const {
    renderTableBilling,
    shouldShowBillingBadge,
    renderBillingWithAutoRenewal,
  } = useMemo(() => {
    const getNodeBilling = (node: VPSNode) =>
      formatNodeBilling(
        {
          price: node.price,
          currency: node.currency,
          billingCycle: node.billingCycle,
          expiredAt: node.expiredAt,
        },
        billingLabels,
      );

    const getPricePart = (node: VPSNode) =>
      formatPricePart(
        node.price,
        node.currency,
        node.billingCycle,
        billingLabels,
      );

    const getPlainPricePart = (node: VPSNode) => {
      if (node.price === 0) return null;
      if (node.price === -1) return billingLabels.billingFree;
      return `${node.currency}${node.price} / ${formatBillingCycleSuffix(
        node.billingCycle,
        billingLabels,
      )}`;
    };

    const renderBilling = (node: VPSNode) => {
      const billing = getNodeBilling(node);
      const pricePart = getPricePart(node);
      const plainPricePart = getPlainPricePart(node);
      const longTermText =
        billing.expiryKind === "long_term"
          ? (plainPricePart ?? billingLabels.billingHidden)
          : billing.text;
      const urgentClass = billing.isExpired
        ? "text-zen-danger font-medium"
        : billing.isUrgent
          ? "text-zen-danger font-medium"
          : "";
      return (
        <span className={`${textPrimary} font-medium ${urgentClass}`}>
          {longTermText}
        </span>
      );
    };

    const isLongTermBilling = (node: VPSNode) =>
      getNodeBilling(node).expiryKind === "long_term";

    const shouldShowAutoRenewal = (node: VPSNode) =>
      shouldShowAutoRenewalBadge({
        expiredAt: node.expiredAt,
        autoRenewal: node.autoRenewal,
        showAutoRenewal,
        isLongTerm: isLongTermBilling(node),
      });

    const autoRenewalText = (node: VPSNode) =>
      node.autoRenewal ? t.autoRenewalEnabled : t.autoRenewalDisabled;

    const autoRenewalBadgeClass = (node: VPSNode) =>
      node.autoRenewal
        ? "border-zen-success/25 bg-zen-success/10 text-zen-success"
        : "border-zen-fg-faint/20 bg-zen-fill-muted/15 text-zen-fg-subtle";

    const billingBadgeClass = (node: VPSNode) =>
      isLongTermBilling(node)
        ? "border-zen-accent/30 bg-zen-accent/12 text-zen-accent"
        : autoRenewalBadgeClass(node);

    const billingBadgeText = (node: VPSNode) =>
      isLongTermBilling(node) ? t.billingLongTermBadge : autoRenewalText(node);

    const shouldShowBillingBadge = (node: VPSNode) =>
      isLongTermBilling(node) || shouldShowAutoRenewal(node);

    const renderBillingBadge = (node: VPSNode) => {
      if (!shouldShowBillingBadge(node)) return null;
      return (
        <span
          className={`inline-flex shrink-0 rounded-sm border px-1 py-px font-mono ${zenType.micro} font-medium tracking-wide leading-none ${billingBadgeClass(node)}`}
        >
          {billingBadgeText(node)}
        </span>
      );
    };

    const renderBillingWithAutoRenewal = (node: VPSNode, compact = false) => (
      <span
        className={`inline-flex min-w-0 items-baseline ${compact ? "gap-1.5" : "gap-2"} ${compact ? "justify-end" : ""}`}
      >
        <span className="min-w-0">{renderBilling(node)}</span>
        {renderBillingBadge(node)}
      </span>
    );

    const renderTableBilling = (node: VPSNode) => {
      const billing = getNodeBilling(node);
      const urgentClass = billing.isExpired
        ? "text-zen-danger font-medium"
        : billing.isUrgent
          ? "text-zen-danger font-medium"
          : "";
      const pricePart = getPricePart(node);
      const plainPricePart = getPlainPricePart(node);
      const hidden = `(${billingLabels.billingHidden})`;
      const trailingPrice = pricePart ?? hidden;

      let mainText = billing.text;
      let suffixText = "";
      if (billing.expiryKind === "active" || billing.expiryKind === "expired") {
        mainText = `${billing.daysRemaining} ${billingLabels.unitDays}`;
        suffixText = trailingPrice;
      } else if (billing.expiryKind === "long_term") {
        mainText = plainPricePart ?? billingLabels.billingHidden;
      }

      return (
        <span
          className={`inline-flex min-w-0 items-baseline gap-2 ${textPrimary} font-medium ${urgentClass}`}
        >
          <span>{mainText}</span>
          {suffixText ? <span>{suffixText}</span> : null}
          {renderBillingBadge(node)}
        </span>
      );
    };
    return {
      renderTableBilling,
      shouldShowBillingBadge,
      renderBillingWithAutoRenewal,
    };
  }, [billingLabels, showAutoRenewal, t]);

  const nodeGroups = useMemo(() => {
    return collectNodeGroups(nodes);
  }, [nodes]);
  const hasOfflineNodes = useMemo(
    () => nodes.some((node) => node.status === "offline"),
    [nodes],
  );
  const showOfflineTab = showOfflineGroup && hasOfflineNodes;

  const showGroupTabs = nodeGroups.length >= 1 || showOfflineTab;

  useEffect(() => {
    const nextGroup = routeGroup || ALL_NODE_GROUP;
    setActiveGroup(nextGroup);
  }, [routeGroup]);

  useEffect(() => {
    searchEditedRef.current = false;
    setSearchTerm(routeSearch);
  }, [routeSearch]);

  useEffect(() => {
    if (!searchEditedRef.current) return;
    const timer = window.setTimeout(() => {
      if (!searchEditedRef.current) return;
      searchEditedRef.current = false;
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("page");
          const query = searchTerm.trim();
          if (query) next.set("q", query);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

  const setSortPreference = useCallback(
    (field: SortField, order: SortOrder) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("page");
          if (field === "default") {
            if (mappedDefaultSort !== "default") {
              next.set("sort", "default");
            } else {
              next.delete("sort");
            }
            next.delete("order");
          } else {
            next.set("sort", field);
            next.set("order", order);
          }
          return next;
        },
        { replace: true },
      );
    },
    [mappedDefaultSort, setSearchParams],
  );

  useEffect(() => {
    if (
      (routeSort === "latency" && !latencyVisible) ||
      (routeSort === "days" && !showExpiryTime)
    ) {
      setSortPreference("default", initialSortOrder);
    }
  }, [
    initialSortOrder,
    latencyVisible,
    routeSort,
    setSortPreference,
    showExpiryTime,
  ]);

  useEffect(() => {
    if (
      activeGroup !== ALL_NODE_GROUP &&
      !nodeGroups.includes(activeGroup) &&
      !(activeGroup === OFFLINE_NODE_GROUP && showOfflineTab)
    ) {
      setActiveGroup(ALL_NODE_GROUP);
      updateGroupSearchParam(ALL_NODE_GROUP, true);
    }
  }, [activeGroup, nodeGroups, showOfflineTab, updateGroupSearchParam]);

  useEffect(() => {
    const scroller = groupScrollRef.current;
    if (!scroller) return;
    refreshGroupScrollFade();
    scroller.addEventListener("scroll", refreshGroupScrollFade, {
      passive: true,
    });
    const ro = new ResizeObserver(refreshGroupScrollFade);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", refreshGroupScrollFade);
      ro.disconnect();
    };
  }, [nodeGroups.length, refreshGroupScrollFade, showOfflineTab]);

  useEffect(() => {
    const scroller = groupScrollRef.current;
    if (!scroller) return;
    const activeChip = scroller.querySelector<HTMLElement>(
      "[data-group-active='true']",
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    activeChip?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeGroup, nodeGroups.length, showOfflineTab]);

  // Filter & Search
  const filteredNodes = useMemo(() => {
    const lowerSearch = deferredSearchTerm.trim().toLowerCase();
    return nodes.filter((node) => {
      const matchGroup =
        activeGroup === ALL_NODE_GROUP ||
        (activeGroup === OFFLINE_NODE_GROUP
          ? showOfflineTab && node.status === "offline"
          : node.nodeGroup === activeGroup);
      const matchSearch = lowerSearch
        ? node.name.toLowerCase().includes(lowerSearch) ||
          node.location.toLowerCase().includes(lowerSearch) ||
          node.os.toLowerCase().includes(lowerSearch) ||
          node.provider.toLowerCase().includes(lowerSearch) ||
          node.tags.toLowerCase().includes(lowerSearch) ||
          node.publicRemark.toLowerCase().includes(lowerSearch) ||
          node.privateRemark.toLowerCase().includes(lowerSearch)
        : true;
      return matchGroup && matchSearch;
    });
  }, [nodes, activeGroup, deferredSearchTerm, showOfflineTab]);

  // Sorting — "default" keeps the order returned by the Komari backend
  // (already weighted + offline-positioned upstream in useKomariNodes).
  const sortedNodes = useMemo(
    () => sortNodeList(filteredNodes, sortField, sortOrder, billingLabels, offlineServerPosition),
    [filteredNodes, sortField, sortOrder, billingLabels, offlineServerPosition],
  );
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(sortedNodes.length / pageSize));
  const requestedPage = Number(searchParams.get("page") ?? 1);
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1,
  );
  const pageNodes = useMemo(
    () => sortedNodes.slice((page - 1) * pageSize, page * pageSize),
    [sortedNodes, page],
  );
  const changePage = (value: number) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value <= 1) next.delete("page");
        else next.set("page", String(value));
        return next;
      },
      { replace: true },
    );
    nodeDisplayRef.current?.scrollIntoView({ block: "start" });
  };
  const pagination =
    pageCount > 1 ? (
      <nav
        aria-label={t.nodePages}
        className="flex flex-wrap items-center justify-end gap-3 border-t border-zen-line pt-3 font-mono text-sm"
      >
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => changePage(page - 1)}
          className="min-h-10 rounded-md border border-zen-border px-3 hover:border-zen-accent hover:text-zen-accent disabled:cursor-default disabled:opacity-35"
        >
          {t.previousPage}
        </button>
        <span aria-live="polite" className="tabular-nums text-zen-fg-muted">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => changePage(page + 1)}
          className="min-h-10 rounded-md border border-zen-border px-3 hover:border-zen-accent hover:text-zen-accent disabled:cursor-default disabled:opacity-35"
        >
          {t.nextPage}
        </button>
      </nav>
    ) : null;
  const {
    displayedItems: displayedNodes,
    className: collectionMotionClass,
    transitioning: collectionTransitioning,
  } = useCollectionTransition(
    pageNodes,
    `${effectiveViewMode}:${activeGroup}:${page}`,
  );

  const listColSpan = (latencyVisible ? 1 : 0) + (showExpiryTime ? 1 : 0) + 7;

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        if (sortOrder === "desc") {
          setSortPreference(field, "asc");
        } else {
          setSortPreference("default", initialSortOrder);
        }
      } else {
        setSortPreference(field, "desc");
      }
    },
    [initialSortOrder, setSortPreference, sortField, sortOrder],
  );

  const handleNodeContainerClick = useCallback(
    (event: React.MouseEvent, node: VPSNode) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("a, button, input, select, textarea, [role='button']")
      ) {
        return;
      }
      onSelectNode(node);
    },
    [onSelectNode],
  );

  const getSortOrderIcon = (order: SortOrder) => (order === "asc" ? "▲" : "▼");

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return " ·";
    return ` ${getSortOrderIcon(sortOrder)}`;
  };

  // Styling helpers
  const borderBottomClass = "border-zen-line-strong";

  const groupTabItems = useMemo(
    () => [
      { id: ALL_NODE_GROUP, label: allGroupsLabel(lang) },
      ...nodeGroups.map((group) => ({ id: group, label: group })),
      ...(showOfflineTab
        ? [{ id: OFFLINE_NODE_GROUP, label: t.lblOfflineGroup }]
        : []),
    ],
    [lang, nodeGroups, showOfflineTab, t.lblOfflineGroup],
  );

  const viewModeTabs = useMemo(
    () => [
      { id: "list" as const, label: t.list, leading: <Table2 size={19} strokeWidth={1.6} aria-hidden /> },
      { id: "card" as const, label: t.card, leading: <LayoutGrid size={19} strokeWidth={1.6} aria-hidden /> },
    ],
    [t.list, t.card],
  );

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th
        key={field}
        scope="col"
        aria-sort={
          isActive ? (sortOrder === "asc" ? "ascending" : "descending") : "none"
        }
        className="py-2 px-2 font-semibold whitespace-nowrap"
      >
        <button
          type="button"
          className={`inline-flex min-h-9 items-center gap-0.5 py-2 font-inherit ${zenMotion.sortHeader} ${
            isActive ? "text-zen-accent" : "hover:text-zen-accent"
          }`}
          onClick={() => handleSort(field)}
        >
          {label}
          <span
            aria-hidden="true"
            className={`inline-block transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)] ${
              isActive ? "scale-110 opacity-100" : "opacity-55"
            }`}
          >
            {getSortIndicator(field)}
          </span>
        </button>
      </th>
    );
  };

  const renderSortControl = (mobileFooter: boolean) => {
    const placement = mobileFooter ? "mobile" : "desktop";
    const menuOpen = openSortMenu === placement;
    const menuId = `${sortMenuIdPrefix}-${placement}`;
    const menuRef = mobileFooter ? mobileSortMenuRef : desktopSortMenuRef;
    const triggerRef = mobileFooter
      ? mobileSortMenuTriggerRef
      : desktopSortMenuTriggerRef;
    const closeAndRestoreFocus = () => {
      setOpenSortMenu(null);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    return (
      <div
        className="km-sort-control"
      >
        <div className="flex items-center gap-2 relative z-30">
          <div className="relative inline-block text-left">
            <button
              type="button"
              ref={triggerRef}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() =>
                setOpenSortMenu((open) =>
                  open === placement ? null : placement,
                )
              }
              aria-label={`${t.sort}: ${getFieldLabel(sortField)}`}
              className={`km-sort-trigger ${zenControl.trigger} ${
                menuOpen ? "text-zen-accent" : textPrimary
              }`}
            >
              <span>{t.sort}<span className="hidden lg:inline">:</span></span>
              <span className="km-sort-current">{getFieldLabel(sortField)}</span>
              {sortField !== "default" ? (
                <span
                  className="normal-case tracking-normal opacity-75 transition-transform duration-300"
                  aria-label={sortOrder === "asc" ? t.sortAsc : t.sortDesc}
                >
                  {getSortOrderIcon(sortOrder)}
                </span>
              ) : null}
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden="true"
                  onClick={() => setOpenSortMenu(null)}
                />
                <div
                  id={menuId}
                  ref={menuRef}
                  role="menu"
                  aria-label={t.selectSortMetric}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeAndRestoreFocus();
                      return;
                    }
                    if (
                      event.key !== "ArrowDown" &&
                      event.key !== "ArrowUp" &&
                      event.key !== "Home" &&
                      event.key !== "End"
                    ) {
                      return;
                    }
                    event.preventDefault();
                    const items = [
                      ...(event.currentTarget.querySelectorAll(
                        "button:not(:disabled)",
                      ) as NodeListOf<HTMLButtonElement>),
                    ];
                    if (items.length === 0) return;
                    const current = Math.max(
                      0,
                      items.indexOf(
                        document.activeElement as HTMLButtonElement,
                      ),
                    );
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? items.length - 1
                          : (current +
                              (event.key === "ArrowDown" ? 1 : -1) +
                              items.length) %
                            items.length;
                    items[next]?.focus();
                  }}
                  onBlur={(event) => {
                    const next = event.relatedTarget;
                    if (
                      next instanceof Node &&
                      (event.currentTarget.contains(next) ||
                        triggerRef.current?.contains(next))
                    ) {
                      return;
                    }
                    setOpenSortMenu(null);
                  }}
                  className={`absolute right-0 top-full z-50 w-48 mt-1 overflow-y-auto overscroll-contain ${zenControl.menu} ${zenMotion.menuPanel}`}
                >
                  <div
                    className={`px-2.5 py-1.5 border-b ${zenType.micro} zen-track-tight font-medium ${"border-zen-border-muted text-zen-fg-subtle"}`}
                  >
                    {t.selectSortMetric}
                  </div>
                  <div className="py-1">
                    {sortOptions.map((opt) => {
                      const isCurrent = sortField === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          role="menuitemradio"
                          aria-checked={isCurrent}
                          onClick={() => {
                            if (opt.value === "default") {
                              setSortPreference("default", initialSortOrder);
                            } else if (isCurrent) {
                              if (sortOrder === "desc") {
                                setSortPreference(opt.value, "asc");
                              } else {
                                setSortPreference("default", initialSortOrder);
                              }
                            } else {
                              setSortPreference(opt.value, "desc");
                            }
                            closeAndRestoreFocus();
                          }}
                          className={`${zenControl.item} justify-between ${
                            isCurrent
                              ? "bg-zen-fill-muted/12 text-zen-accent font-medium"
                              : "hover:bg-zen-fill-muted/10"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isCurrent && opt.value !== "default" && (
                            <span
                              className={`text-zen-accent ${zenType.micro}`}
                            >
                              {getSortOrderIcon(sortOrder)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t p-1 border-zen-line">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={sortField === "default"}
                      onClick={() => {
                        if (sortField !== "default") {
                          setSortPreference(
                            sortField,
                            sortOrder === "asc" ? "desc" : "asc",
                          );
                        }
                        closeAndRestoreFocus();
                      }}
                      aria-label={
                        sortOrder === "asc"
                          ? t.setSortDescending
                          : t.setSortAscending
                      }
                      className={`${zenControl.item} text-zen-accent disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {sortOrder === "asc" ? t.setSortDescending : t.setSortAscending}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openLatencyModal = useCallback((node: VPSNode) => {
    setLatencyModalNode(node);
  }, []);

  return (
    <div
      ref={nodeDisplayRef}
      className={`km-node-display w-full space-y-6 lg:space-y-8 font-sans ${zenType.body} ${zenText.primary}`}
    >
      <div className="km-home-toolbar">
        {showGroupTabs ? (
          <div className="km-toolbar-groups">
            {groupScrollFade.left ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-3 bg-gradient-to-r from-zen-bg to-transparent" aria-hidden />
            ) : null}
            {groupScrollFade.right ? (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-4 bg-gradient-to-l from-zen-bg to-transparent" aria-hidden />
            ) : null}
            <ZenTabControl
              ariaLabel={t.lblClusterNodeStatus}
              ref={groupScrollRef}
              scrollable
              tabs={groupTabItems}
              value={activeGroup}
              onChange={handleGroupChange}
              separator={<span>/</span>}
              tabClassName="font-medium"
              activeClassName="font-medium text-zen-fg-strong"
              idleClassName="text-zen-fg-muted hover:text-zen-fg-strong"
            />
          </div>
        ) : <div className="km-toolbar-groups" />}

        <div className="km-toolbar-view">
          <ZenTabControl
            ariaLabel={t.viewMode}
            tabs={viewModeTabs}
            separator={<span className="text-zen-fg-faint">|</span>}
            value={effectiveViewMode}
            onChange={(id) => setViewMode(id as "list" | "card")}
            activeClassName="font-medium text-zen-fg-strong"
            idleClassName="text-zen-fg-muted hover:text-zen-fg-strong"
          />
        </div>

        <div className="km-toolbar-search">
          <Search size={18} strokeWidth={1.7} aria-hidden />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              searchEditedRef.current = true;
              setSearchTerm(event.target.value);
            }}
            placeholder={`${t.search}: ...`}
            aria-label={t.search}
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                searchEditedRef.current = true;
                setSearchTerm("");
              }}
              aria-label={t.clearSearch}
              className="flex h-9 shrink-0 items-center hover:text-zen-accent"
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </div>

        <details
          ref={mobileFilterRef}
          className="km-toolbar-filter"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              event.currentTarget.open = false;
            }
          }}
        >
          <summary>{t.filter}<ChevronDown size={16} strokeWidth={1.75} aria-hidden /></summary>
          <div className="km-toolbar-filter-panel">
            <p>{t.matchingInstances}: {filteredNodes.length} / {nodes.length}</p>
            <ZenTabControl
              ariaLabel={t.viewMode}
              tabs={viewModeTabs}
              value={effectiveViewMode}
              onChange={(id) => {
                setViewMode(id as "list" | "card");
                if (mobileFilterRef.current) mobileFilterRef.current.open = false;
              }}
              tabClassName="min-h-11 px-2"
              activeClassName="font-medium text-zen-fg-strong"
              idleClassName="text-zen-fg-muted"
            />
          </div>
        </details>

        {renderSortControl(false)}
      </div>

      {pagination}
      {/* VIEW STATE 1: HIGH-DENSITY BULLET-ALIGNED LIST VIEW */}
      {effectiveViewMode === "list" ? (
        <div
          className={`overflow-x-auto w-full ${collectionMotionClass}`}
          aria-busy={collectionTransitioning}
        >
          <table className="km-ui-table w-full min-w-[1100px] text-left border-collapse">
            <thead>
              <tr
                className={`${textMuted} ${zenType.caption} zen-track-tight border-b ${borderBottomClass} whitespace-nowrap`}
              >
                {renderSortHeader("name", t.name)}
                {renderSortHeader("os", t.os)}
                {renderSortHeader("cpu", t.cpu)}
                {renderSortHeader("mem", t.mem)}
                {renderSortHeader("disk", t.diskspace)}
                {latencyVisible && renderSortHeader("latency", t.ping)}
                {renderSortHeader("bandwidth", t.bandwidth)}
                {renderSortHeader("traffic", t.traffic)}
                {showExpiryTime && renderSortHeader("days", t.expiry)}
              </tr>
            </thead>
            <tbody className={`${zenType.data} font-mono whitespace-nowrap`}>
              {displayedNodes.length === 0 ? (
                <tr>
                  <td
                    colSpan={listColSpan}
                    className="py-8 whitespace-normal font-sans"
                  >
                    <UIState inline>{t.noInstances}</UIState>
                  </td>
                </tr>
              ) : (
                displayedNodes.map((node) => (
                  <NodeListRow
                    key={node.id}
                    node={node}
                    lang={lang}
                    theme={theme}
                    latencyVisible={latencyVisible}
                    showExpiryTime={showExpiryTime}
                    latencyColorConfig={latencyColorConfig}
                    handleNodeContainerClick={handleNodeContainerClick}
                    openLatencyModal={openLatencyModal}
                    renderTableBilling={renderTableBilling}
                    shouldShowBillingBadge={shouldShowBillingBadge}
                    renderBillingWithAutoRenewal={renderBillingWithAutoRenewal}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW STATE 2: CARD GRID VIEW (Fully localized with zero mixed layouts) */
        <div
          className={`grid grid-cols-1 items-start gap-4 pt-4 @min-[640px]:grid-cols-2 @min-[901px]:grid-cols-3 @min-[1300px]:grid-cols-4 @min-[1600px]:grid-cols-5 ${collectionMotionClass}`}
          aria-busy={collectionTransitioning}
        >
          {displayedNodes.length === 0 ? (
            <div
              className="col-span-full"
            >
              <UIState>{t.noInstances}</UIState>
            </div>
          ) : (
            displayedNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                lang={lang}
                theme={theme}
                latencyVisible={latencyVisible}
                showExpiryTime={showExpiryTime}
                latencyColorConfig={latencyColorConfig}
                handleNodeContainerClick={handleNodeContainerClick}
                openLatencyModal={openLatencyModal}
                renderTableBilling={renderTableBilling}
                shouldShowBillingBadge={shouldShowBillingBadge}
                renderBillingWithAutoRenewal={renderBillingWithAutoRenewal}
              />
            ))
          )}
        </div>
      )}

      {pagination}
      {latencyVisible ? (
        <LatencyProbeModal
          open={latencyModalNode != null}
          onClose={() => setLatencyModalNode(null)}
          node={latencyModalNode}
          theme={theme}
          lang={lang}
        />
      ) : null}
    </div>
  );
}

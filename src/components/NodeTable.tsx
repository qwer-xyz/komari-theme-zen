/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { VPSNode } from "../types";
import { translations, Lang, formatMsg } from "../lib/i18n";
import {
  formatKbps,
  formatNodeTraffic,
  getTrafficTypeShortLabel,
  type TrafficLimitType,
} from "@/lib/formatUnits";
import {
  formatBillingCycleSuffix,
  formatNodeBilling,
  formatPricePart,
  type BillingLabels,
} from "@/lib/billingDisplay";
import {
  ALL_NODE_GROUP,
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
import { Flag } from "@/components/Flag";
import { OsIcon } from "@/components/OsIcon";
import { NodeTags } from "@/components/NodeTags";
import { PublicRemarkButton } from "@/components/PublicRemarkButton";
import { LatencyHistoryBlocks } from "@/components/LatencyHistoryBlocks";
import { LatencyProbeModal } from "@/components/LatencyProbeModal";
import { MetricPercentBar } from "@/components/MetricSegmentBar";
import { metricPercentFillClass } from "@/lib/latencyDisplay";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenFill, zenInteractive, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";
import { ZenTabControl } from "@/components/motion/ZenTabControl";

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
    defaultViewMode,
    defaultSortField,
    defaultSortOrder,
    showLatency,
    latencyColorConfig,
  } = useThemeSettings();
  const { recordEnabled } = useRecordSettings();
  const latencyVisible = recordEnabled && showLatency;
  const [searchParams, setSearchParams] = useSearchParams();
  const routeGroup = (searchParams.get("group") ?? "").trim();

  const mappedDefaultSort = SORT_FIELD_MAP[defaultSortField] ?? "default";
  const initialSortField: SortField =
    mappedDefaultSort === "latency" && !latencyVisible ? "default" : mappedDefaultSort;
  const initialSortOrder: SortOrder =
    defaultSortOrder === "Descending" ? "desc" : "asc";

  const [activeGroup, setActiveGroup] = useState<string>(
    () => routeGroup || ALL_NODE_GROUP,
  );
  const [latencyModalNode, setLatencyModalNode] = useState<VPSNode | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);
  const userSortedRef = React.useRef(false);
  const groupScrollRef = useRef<HTMLDivElement>(null);
  const [groupScrollFade, setGroupScrollFade] = useState({ left: false, right: false });

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

  const { viewMode, effectiveViewMode, setViewMode } = useViewMode(defaultViewMode);

  const updateGroupSearchParam = useCallback(
    (group: string, replace = false) => {
      const nextParams = new URLSearchParams(searchParams);
      if (group === ALL_NODE_GROUP) {
        nextParams.delete("group");
      } else {
        nextParams.set("group", group);
      }
      setSearchParams(nextParams, { replace });
    },
    [searchParams, setSearchParams],
  );

  const handleGroupChange = useCallback(
    (group: string) => {
      setActiveGroup(group);
      updateGroupSearchParam(group);
    },
    [updateGroupSearchParam],
  );

  // Apply admin-configured default until the user manually changes the sort.
  React.useEffect(() => {
    if (userSortedRef.current) return;
    setSortField(initialSortField);
    setSortOrder(initialSortOrder);
  }, [initialSortField, initialSortOrder]);

  React.useEffect(() => {
    if (!latencyVisible && sortField === "latency") {
      setSortField("default");
    }
  }, [latencyVisible, sortField]);

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
    ...(latencyVisible ? [{ value: "latency" as SortField, label: t.ping }] : []),
    ...(showExpiryTime ? [{ value: "days" as SortField, label: t.expiry }] : []),
    { value: "os", label: t.os },
    { value: "status", label: t.status },
  ];

  const formatSpeed = (kbps: number) => formatKbps(kbps);

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
      ? "text-zen-danger font-bold"
      : billing.isUrgent
        ? "text-zen-danger font-bold"
        : "";
    return (
      <span className={`${textPrimary} font-bold ${urgentClass}`}>
        {longTermText}
      </span>
    );
  };

  const isLongTermBilling = (node: VPSNode) =>
    getNodeBilling(node).expiryKind === "long_term";

  const shouldShowAutoRenewal = (node: VPSNode) =>
    showAutoRenewal &&
    typeof node.autoRenewal === "boolean" &&
    !isLongTermBilling(node);

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
        className={`inline-flex shrink-0 rounded-sm border px-1 py-px font-mono ${zenType.micro} font-bold tracking-wide leading-none ${billingBadgeClass(node)}`}
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
      ? "text-zen-danger font-bold"
      : billing.isUrgent
        ? "text-zen-danger font-bold"
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
    } else if (billing.expiryKind === "none" && pricePart) {
      mainText = billingLabels.billingNotSet;
      suffixText = pricePart;
    }

    return (
      <span
        className={`inline-flex min-w-0 items-baseline gap-2 ${textPrimary} font-bold ${urgentClass}`}
      >
        <span>{mainText}</span>
        {suffixText ? <span>{suffixText}</span> : null}
        {renderBillingBadge(node)}
      </span>
    );
  };

  const renderTrafficValue = (node: VPSNode) => (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="truncate">{formatNodeTraffic(node)}</span>
      {node.bandwidthTotal <= 0 ? (
        <span
          className={`inline-flex shrink-0 px-1 py-px rounded-sm border ${zenType.micro} font-bold tracking-wide leading-none ${unlimitedTrafficBadgeClass}`}
        >
          <span className={unlimitedTrafficSymbolClass}>∞</span>
        </span>
      ) : (
        <span
          className={`inline-flex shrink-0 px-1 py-px rounded-sm border ${zenType.micro} font-bold tracking-wide leading-none ${trafficTypeBadgeClass(node.trafficLimitType)}`}
        >
          {getTrafficTypeShortLabel(node.trafficLimitType)}
        </span>
      )}
    </span>
  );

  const nodeGroups = useMemo(() => {
    return collectNodeGroups(nodes);
  }, [nodes]);

  const showGroupTabs = nodeGroups.length >= 1;

  useEffect(() => {
    const nextGroup = routeGroup || ALL_NODE_GROUP;
    setActiveGroup(nextGroup);
  }, [routeGroup]);

  useEffect(() => {
    if (
      activeGroup !== ALL_NODE_GROUP &&
      !nodeGroups.includes(activeGroup)
    ) {
      setActiveGroup(ALL_NODE_GROUP);
      updateGroupSearchParam(ALL_NODE_GROUP, true);
    }
  }, [activeGroup, nodeGroups, updateGroupSearchParam]);

  useEffect(() => {
    const scroller = groupScrollRef.current;
    if (!scroller) return;
    refreshGroupScrollFade();
    scroller.addEventListener("scroll", refreshGroupScrollFade, { passive: true });
    const ro = new ResizeObserver(refreshGroupScrollFade);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", refreshGroupScrollFade);
      ro.disconnect();
    };
  }, [nodeGroups.length, refreshGroupScrollFade]);

  useEffect(() => {
    const scroller = groupScrollRef.current;
    if (!scroller) return;
    const activeChip = scroller.querySelector<HTMLElement>("[data-group-active='true']");
    activeChip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeGroup, nodeGroups.length]);

  useEffect(() => {
    if (!showExpiryTime && sortField === "days") {
      setSortField("default");
    }
  }, [showExpiryTime, sortField]);

  // Filter & Search
  const filteredNodes = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return nodes.filter((node) => {
      const matchGroup =
        activeGroup === ALL_NODE_GROUP || node.nodeGroup === activeGroup;
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
  }, [nodes, activeGroup, searchTerm]);

  // Sorting — "default" keeps the order returned by the Komari backend
  // (already weighted + offline-positioned upstream in useKomariNodes).
  const sortedNodes = useMemo(
    () => sortNodeList(filteredNodes, sortField, sortOrder, billingLabels),
    [filteredNodes, sortField, sortOrder, billingLabels],
  );

  const listColSpan =
    (latencyVisible ? 1 : 0) +
    (showExpiryTime ? 1 : 0) +
    7;

  const handleSort = useCallback((field: SortField) => {
    userSortedRef.current = true;
    if (sortField === field) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else {
        setSortField("default");
        setSortOrder(initialSortOrder);
      }
    } else {
      setSortField(field);
      setSortOrder("desc"); // Default to desc for performance metrics
    }
  }, [initialSortOrder, sortField, sortOrder]);

  const getSortOrderIcon = (order: SortOrder) => (order === "asc" ? "▲" : "▼");

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return " ·";
    return ` ${getSortOrderIcon(sortOrder)}`;
  };

  // Styling helpers
  const textPrimary = zenText.primary;
  const textMuted = zenText.muted;
  const borderBottomClass = "border-zen-line-strong";
  const toolbarPanelClass = "border-zen-border-muted bg-zen-elevate/15";
  const groupChipIdle =
    "border border-zen-border text-zen-fg-subtle hover:border-zen-fg-muted hover:text-zen-fg-strong";
  const segmentTrackClass =
    "border border-zen-border bg-zen-fill-muted/30";

  const groupTabItems = useMemo(
    () => [
      { id: ALL_NODE_GROUP, label: allGroupsLabel(lang) },
      ...nodeGroups.map((group) => ({ id: group, label: group })),
    ],
    [lang, nodeGroups],
  );

  const viewModeTabs = useMemo(
    () => [
      { id: "list" as const, label: t.list },
      { id: "card" as const, label: t.card },
    ],
    [t.list, t.card],
  );

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th
        key={field}
        className={`py-4 px-2 font-black cursor-pointer whitespace-nowrap ${zenMotion.sortHeader} ${
          isActive ? "text-zen-accent" : "hover:text-zen-accent"
        }`}
        onClick={() => handleSort(field)}
      >
        {label}
        <span
          className={`inline-block transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)] ${
            isActive ? "scale-110 opacity-100" : "opacity-55"
          }`}
        >
          {getSortIndicator(field)}
        </span>
      </th>
    );
  };

  const renderStatsBar = (mobileFooter: boolean) => (
    <div
      className={`${zenType.label} tracking-[0.2em] ${textMuted} flex flex-wrap justify-between items-center gap-x-4 gap-y-2 uppercase font-mono ${
        mobileFooter ? "pt-3 border-t border-zen-line-strong" : "sm:items-baseline tracking-[0.25em]"
      }`}
    >
      <span>
        {t.matchingInstances}: {sortedNodes.length} / {nodes.length}
      </span>
      <div className="flex items-center gap-2 relative z-30">
        <span>{t.sort}:</span>
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
            className={`cursor-pointer select-none font-bold flex items-center gap-1 uppercase leading-none transition-[color,transform] duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)] active:scale-[0.97] ${
              isSortMenuOpen ? "text-zen-accent" : textPrimary
            }`}
          >
            {getFieldLabel(sortField)}
            {sortField !== "default" ? (
              <span
                className="normal-case tracking-normal opacity-75 transition-transform duration-300"
                aria-label={sortOrder === "asc" ? t.sortAsc : t.sortDesc}
              >
                {getSortOrderIcon(sortOrder)}
              </span>
            ) : null}
          </button>
          {isSortMenuOpen && (
            <>
              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsSortMenuOpen(false)} />
              <div className={`absolute right-0 top-full z-50 w-44 border overflow-hidden ${zenMotion.menuPanel} ${
                theme === "dark"
                  ? "bg-zen-bg border-zen-border-muted text-zen-fg-muted"
                  : "bg-zen-bg border-zen-border text-zen-fg-strong"
              }`}>
                <div className={`px-2.5 py-1.5 border-b ${zenType.micro} zen-track-tight font-bold ${
                  "border-zen-border-muted text-zen-fg-subtle"
                }`}>
                  {t.selectSortMetric}
                </div>
                <div className="py-1">
                  {sortOptions.map((opt) => {
                    const isCurrent = sortField === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          userSortedRef.current = true;
                          if (opt.value === "default") {
                            setSortField("default");
                            setSortOrder(initialSortOrder);
                          } else if (isCurrent) {
                            if (sortOrder === "desc") {
                              setSortOrder("asc");
                            } else {
                              setSortField("default");
                              setSortOrder(initialSortOrder);
                            }
                          } else {
                            setSortField(opt.value);
                            setSortOrder("desc");
                          }
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 md:py-1.5 ${zenType.caption} tracking-wider uppercase font-mono transition-colors flex items-center justify-between ${
                          isCurrent
                            ? "bg-zen-fill-muted/12 text-zen-accent font-bold"
                            : "hover:bg-zen-fill-muted/10"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isCurrent && opt.value !== "default" && (
                          <span className={`text-zen-accent ${zenType.micro}`}>
                            {getSortOrderIcon(sortOrder)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t p-1 border-zen-line">
                  <button
                    onClick={() => {
                      userSortedRef.current = true;
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      setIsSortMenuOpen(false);
                    }}
                    aria-label={sortOrder === "asc" ? t.setSortDescending : t.setSortAscending}
                    className={`w-full text-center px-1 py-1 ${zenType.caption} uppercase font-bold tracking-widest text-zen-accent hover:underline transition-all`}
                  >
                    [ {getSortOrderIcon(sortOrder === "asc" ? "desc" : "asc")} ]
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const openLatencyModal = useCallback((node: VPSNode) => {
    setLatencyModalNode(node);
  }, []);

  return (
    <div className={`w-full space-y-6 lg:space-y-8 font-sans ${zenType.body} ${zenText.primary}`}>
      {/* Mobile toolbar card */}
      <div
        className={`space-y-4 lg:hidden rounded-xl border p-4 ${toolbarPanelClass}`}
      >
        {showGroupTabs ? (
          <div className="relative min-w-0">
            {groupScrollFade.left ? (
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-3 bg-gradient-to-r ${
                  "from-zen-bg/80"
                } to-transparent`}
                aria-hidden
              />
            ) : null}
            {groupScrollFade.right ? (
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-5 bg-gradient-to-l ${
                  "from-zen-bg/80"
                } to-transparent`}
                aria-hidden
              />
            ) : null}
            <ZenTabControl
              ref={groupScrollRef}
              variant="pill"
              scrollable
              tabs={groupTabItems}
              value={activeGroup}
              onChange={handleGroupChange}
              tabClassName={`snap-start rounded-full px-3.5 py-1.5 font-mono ${zenType.caption} zen-track-tight font-bold`}
              activeClassName="font-black text-zen-fg-strong"
              idleClassName={groupChipIdle}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between gap-3">
            <span className={`${zenType.label} ${textMuted} shrink-0 tracking-[0.18em] uppercase`}>
              {t.viewMode}
            </span>
            <div className={`inline-flex rounded-full p-0.5 ${segmentTrackClass}`}>
              <ZenTabControl
                variant="pill"
                tabs={viewModeTabs}
                value={viewMode}
                onChange={(id) => setViewMode(id as "list" | "card")}
                tabClassName={`${zenTouch.btn} rounded-full px-3.5 py-1 font-mono ${zenType.caption} zen-track-tight font-bold`}
                activeClassName="font-black text-zen-fg-strong"
                idleClassName={`${textMuted} hover:text-zen-accent`}
                className="gap-0.5"
              />
            </div>
          </div>
          <div className="relative flex min-w-0 items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className={`w-full min-w-0 rounded-md border border-zen-line-strong bg-zen-elevate/15 px-3 py-2 outline-none transition-all font-mono ${zenType.body} tracking-wide uppercase ${textPrimary} placeholder:text-zen-fg-faint/60`}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className={`absolute right-2 ${zenInteractive.clear} font-mono ${zenType.caption} cursor-pointer`}
                aria-label="Clear"
              >
                [X]
              </button>
            ) : null}
          </div>
        </div>

        {renderStatsBar(true)}
      </div>

      {/* Desktop toolbar — original layout */}
      <div className="hidden lg:flex flex-col gap-8">
        <div className="flex flex-row items-center justify-between gap-8 py-2">
          {showGroupTabs ? (
            <div className="flex h-8 min-w-0 flex-1 items-center overflow-x-auto overscroll-x-contain scroll-smooth pr-2 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ZenTabControl
                tabs={groupTabItems}
                value={activeGroup}
                onChange={handleGroupChange}
                separator={
                  <span
                    className={`font-mono font-light ${zenType.caption} ${zenText.faint}/70`}
                  >
                    {" / "}
                  </span>
                }
                tabClassName={`font-sans ${zenType.caption} zen-track-tight`}
                activeClassName={`${textPrimary} font-black`}
                idleClassName={`${textMuted} hover:text-zen-accent font-bold`}
                className="h-8 w-max min-w-max flex-nowrap gap-x-2"
              />
            </div>
          ) : (
            <div className="h-8 min-w-0 flex-1" />
          )}

          <div className="flex h-8 shrink-0 flex-nowrap items-center gap-x-8 font-mono">
            <div className={`flex h-8 items-center gap-3 ${zenType.caption} tracking-[0.2em] uppercase`}>
              <span className={`${textMuted} shrink-0 leading-none`}>{t.viewMode}:</span>
              <ZenTabControl
                tabs={viewModeTabs.map((tab) => ({
                  ...tab,
                  label: `[ ${tab.label} ]`,
                }))}
                value={viewMode}
                onChange={(id) => setViewMode(id as "list" | "card")}
                tabClassName="inline-flex items-center leading-none py-0"
                activeClassName={`${textPrimary} font-bold`}
                idleClassName={`${textMuted} hover:text-zen-accent`}
                className="h-8 gap-3"
              />
            </div>

            <div className="flex h-8 items-center gap-2">
              <span className={`${zenType.label} ${textMuted} shrink-0 leading-none tracking-[0.2em] uppercase`}>
                {t.search}:
              </span>
              <div
                className={`inline-flex items-center gap-1 border-b ${borderBottomClass}`}
              >
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="..."
                  className={`min-w-0 w-40 border-0 bg-transparent py-1 pl-1 pr-0 outline-none transition-all font-mono ${zenType.body} placeholder:text-zen-fg-faint tracking-wider uppercase ${textPrimary}`}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className={`shrink-0 py-1 leading-none ${zenInteractive.clear} font-mono ${zenType.caption} cursor-pointer`}
                  >
                    [X]
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {renderStatsBar(false)}
      </div>

      {/* VIEW STATE 1: HIGH-DENSITY BULLET-ALIGNED LIST VIEW */}
      {effectiveViewMode === "list" ? (
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[1100px] text-left select-none border-collapse">
            <thead>
              <tr className={`${textMuted} ${zenType.caption} zen-track-tight uppercase border-b ${borderBottomClass} whitespace-nowrap`}>
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
              {sortedNodes.length === 0 ? (
                <tr>
                  <td colSpan={listColSpan} className={`py-16 text-center ${textMuted} italic uppercase tracking-[0.2em] font-sans`}>
                     {t.noInstances}
                  </td>
                </tr>
              ) : (
                sortedNodes.map((node) => {
                  const cpuColor =
                    node.cpuUsage > 75
                      ? "text-zen-danger font-bold" 
                      : node.cpuUsage > 40 
                      ? "text-zen-warning font-bold" 
                      : textPrimary;

                  const memPercent = (node.memoryUsed / node.memoryTotal) * 100;
                  const memColor =
                    memPercent > 80
                      ? "text-zen-danger font-bold" 
                      : memPercent > 50 
                      ? "text-zen-warning font-bold" 
                      : textPrimary;

                  const diskPercent = (node.diskUsed / node.diskTotal) * 100;
                  const diskColor =
                    diskPercent > 80
                      ? "text-zen-danger font-bold" 
                      : diskPercent > 50 
                      ? "text-zen-warning font-bold" 
                      : textPrimary;

                  return (
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode(node)}
                      className={`cursor-pointer group border-b border-zen-line hover:bg-zen-elevate transition-[background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        !node.online ? "opacity-35 grayscale contrast-75 saturate-50 select-none" : ""
                      }`}
                    >
                      {/* Identification */}
                      <td className={`py-3 px-2 font-sans font-black ${textPrimary}`}>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Flag flag={node.flag} className="w-4 h-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate max-w-[240px] md:max-w-[200px]" title={node.name}>
                              {node.name}
                            </span>
                            <PublicRemarkButton
                              publicRemark={node.publicRemark}
                              privateRemark={node.privateRemark}
                              theme={theme}
                              publicLabel={t.publicRemark}
                              privateLabel={t.privateRemark}
                              className="shrink-0 ml-auto"
                            />
                          </div>
                          <NodeTags
                            tags={node.tags}
                            theme={theme}
                            size="sm"
                            maxVisible={2}
                          />
                        </div>
                      </td>
 
                      {/* OS Specific */}
                      <td className={`py-3 px-2 ${textMuted} ${zenType.data} whitespace-nowrap`}>
                        {(() => {
                          const osDetails = getOSDetails(node.os, node.arch);
                          return (
                            <span className="flex items-center gap-2 inline-flex">
                              <OsIcon os={node.os} />
                              <span>{osDetails.text}</span>
                            </span>
                          );
                        })()}
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
                            onValueClick={() => openLatencyModal(node)}
                          />
                        ) : (
                          <span className={textMuted}>—</span>
                        )}
                      </td>
                      )}

                      {/* Bandwidth Speed */}
                      <td className="py-3 px-2">
                        {node.online ? (
                          <span className={`inline-flex items-baseline gap-x-2 font-bold ${textPrimary}`}>
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
                          <span className={`font-bold ${textPrimary}`}>
                            {renderTrafficValue(node)}
                          </span>
                        ) : (
                          "---"
                        )}
                      </td>

                      {showExpiryTime && (
                        <td className={`py-3 px-2 ${zenType.data} font-bold`}>
                          {renderTableBilling(node)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW STATE 2: CARD GRID VIEW (Fully localized with zero mixed layouts) */
        <div className="grid grid-cols-1 items-start gap-4 pt-4 @min-[640px]:grid-cols-2 @min-[901px]:grid-cols-3 @min-[1300px]:grid-cols-4 @min-[1600px]:grid-cols-5">
          {sortedNodes.length === 0 ? (
            <div className={`col-span-full py-16 text-center ${textMuted} italic uppercase tracking-[0.2em] font-sans`}>
              {t.noInstances}
            </div>
          ) : (
            sortedNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const cpuColor =
                node.cpuUsage > 75
                  ? "text-zen-danger font-bold"
                  : node.cpuUsage > 40
                    ? "text-zen-warning font-bold"
                    : textPrimary;

              const memPercent = (node.memoryUsed / node.memoryTotal) * 100;
              const memColor =
                memPercent > 80
                  ? "text-zen-danger font-bold"
                  : memPercent > 50
                    ? "text-zen-warning font-bold"
                    : textPrimary;

              const diskPercent = (node.diskUsed / node.diskTotal) * 100;
              const diskColor =
                diskPercent > 80
                  ? "text-zen-danger font-bold"
                  : diskPercent > 50
                    ? "text-zen-warning font-bold"
                    : textPrimary;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`cursor-pointer group flex flex-col gap-3 p-4 sm:p-5 rounded-xl border border-zen-line bg-zen-elevate shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-zen-line-strong hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)] ${zenMotion.card} ${!node.online ? "opacity-35 grayscale contrast-75 saturate-50 select-none" : ""}`}
                >
                  {/* Card header：标签与标题同一行，不额外占高 */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag flag={node.flag} className="w-5 h-5 shrink-0" />
                    <h4
                      className={`min-w-0 flex-1 truncate font-sans ${zenType.body} font-bold tracking-tight ${textPrimary}`}
                      title={node.name}
                    >
                      {node.name}
                    </h4>
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
                  <div className={`space-y-2 font-mono ${zenType.data} leading-relaxed uppercase ${textMuted}`}>
                    <div className="flex justify-between">
                      <span>{t.os}:</span>
                      <span className={`font-bold ${textPrimary} flex items-center gap-2`}>
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
                          onValueClick={() => openLatencyModal(node)}
                        />
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    )}
                    <div className="flex justify-between">
                      <span>{t.bandwidth}:</span>
                      {node.online ? (
                        <span className={`inline-flex items-baseline gap-x-2 font-bold ${textPrimary}`}>
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
                        <span className={`font-bold ${textPrimary} min-w-0 text-right`}>
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
                </div>
              );
            })
          )}
        </div>
      )}

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

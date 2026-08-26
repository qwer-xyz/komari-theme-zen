import { usePublicInfo } from "@/contexts/PublicInfoContext";

import type { NodeViewMode } from "@/hooks/useViewMode";
import { parseDefaultViewMode } from "@/hooks/useViewMode";
import { parseThemeSelectOption } from "@/lib/themeOptionValue";
import {
  colorSchemeFromTheme,
  type ColorSchemeSettings,
} from "@/lib/colorScheme";
import {
  fontSchemeFromTheme,
  type FontSchemeSettings,
} from "@/lib/fontScheme";
import {
  latencyColorConfigFromTheme,
  type LatencyColorConfig,
} from "@/lib/latencyDisplay";

export type ThemeSettings = {
  showLogo: boolean;
  customLogoUrl: string;
  logoShape: LogoShape;
  offlineServerPosition: string;
  showOfflineGroup: boolean;
  showExpiryTime: boolean;
  showAutoRenewal: boolean;
  showResidualValue: boolean;
  residualValueCurrency: string;
  dashboardOverviewLayout: DashboardOverviewLayout;
  dashboardOverviewSections: DashboardOverviewSections;
  dashboardCpuMetric: DashboardCpuMetric;
  dashboardBandwidthMetric: DashboardBandwidthMetric;
  dashboardNodeIds: string[];
  pingTaskIds: number[];
  customFooterHtml: string;
  defaultViewMode: NodeViewMode;
  defaultSortField: string;
  defaultSortOrder: string;
  showLatency: boolean;
  showNetworkQuality: boolean;
  showNodeMap: boolean;
  latencyColorConfig: LatencyColorConfig;
  colorScheme: ColorSchemeSettings;
  fontScheme: FontSchemeSettings;
};

export type LogoShape = "Circle" | "RoundedSquare" | "Square";
export type DashboardOverviewLayout = "Panel" | "Classic";
export type DashboardOverviewSections = "All" | "Heroes" | "Stats" | "None";
export type DashboardCpuMetric = "Average" | "Max";
export type DashboardBandwidthMetric = "Total" | "Max";

function parseLogoShape(raw: unknown): LogoShape {
  const shape = parseThemeSelectOption(raw, "RoundedSquare");
  if (shape === "Circle" || shape === "Square") return shape;
  return "RoundedSquare";
}

function parseDashboardCpuMetric(raw: unknown): DashboardCpuMetric {
  const metric = parseThemeSelectOption(raw, "Average");
  return metric === "Max" ? "Max" : "Average";
}

function parseDashboardOverviewLayout(raw: unknown): DashboardOverviewLayout {
  const layout = parseThemeSelectOption(raw, "Panel");
  return layout === "Classic" ? "Classic" : "Panel";
}

function parseDashboardOverviewSections(
  raw: unknown,
): DashboardOverviewSections {
  const sections = parseThemeSelectOption(raw, "All");
  if (sections === "Heroes" || sections === "Stats" || sections === "None") {
    return sections;
  }
  return "All";
}

function parseDashboardBandwidthMetric(raw: unknown): DashboardBandwidthMetric {
  const metric = parseThemeSelectOption(raw, "Total");
  return metric === "Max" ? "Max" : "Total";
}

function parseArraySetting<T extends string | number>(
  raw: unknown,
  kind: "string" | "number",
): T[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const normalized = value.filter((item): item is T => typeof item === kind);
  return [...new Set(normalized)];
}

export function useThemeSettings(): ThemeSettings {
  const { publicInfo } = usePublicInfo();
  const raw = (publicInfo?.theme_settings ?? {}) as Record<string, unknown>;

  return {
    showLogo: raw.showLogo === true,
    customLogoUrl:
      typeof raw.customLogoUrl === "string" ? raw.customLogoUrl.trim() : "",
    logoShape: parseLogoShape(raw.logoShape),
    offlineServerPosition: parseThemeSelectOption(
      raw.offlineServerPosition,
      "Last",
    ),
    showOfflineGroup: raw.showOfflineGroup === true,
    showExpiryTime: raw.showExpiryTime !== false,
    showAutoRenewal: raw.showAutoRenewal !== false,
    showResidualValue: raw.showResidualValue === true,
    residualValueCurrency:
      typeof raw.residualValueCurrency === "string"
        ? raw.residualValueCurrency.trim()
        : "CNY",
    dashboardOverviewLayout: parseDashboardOverviewLayout(
      raw.dashboardOverviewLayout,
    ),
    dashboardOverviewSections: parseDashboardOverviewSections(
      raw.dashboardOverviewSections,
    ),
    dashboardCpuMetric: parseDashboardCpuMetric(raw.dashboardCpuMetric),
    dashboardBandwidthMetric: parseDashboardBandwidthMetric(
      raw.dashboardBandwidthMetric,
    ),
    dashboardNodeIds: parseArraySetting<string>(raw.dashboardNodeIds, "string"),
    pingTaskIds: parseArraySetting<number>(raw.pingTaskIds, "number"),
    customFooterHtml: (raw.customFooterHtml as string | undefined) ?? "",
    defaultViewMode: parseDefaultViewMode(raw.defaultViewMode),
    defaultSortField: parseThemeSelectOption(raw.defaultSortField, "Default"),
    defaultSortOrder: parseThemeSelectOption(raw.defaultSortOrder, "Ascending"),
    showLatency: raw.showLatency !== false,
    showNetworkQuality: raw.showNetworkQuality !== false,
    showNodeMap: raw.showNodeMap !== false,
    latencyColorConfig: latencyColorConfigFromTheme(raw),
    colorScheme: colorSchemeFromTheme(raw),
    fontScheme: fontSchemeFromTheme(raw),
  };
}

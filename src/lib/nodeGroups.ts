import type { Lang } from "./i18n/types";
import { translations } from "./i18n";

/** Sentinel for the "show all groups" filter tab — not a real node group name. */
export const ALL_NODE_GROUP = "__all__";

export function collectNodeGroups(
  nodes: { nodeGroup?: string }[],
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const node of nodes) {
    const g = node.nodeGroup?.trim();
    if (g && !seen.has(g)) {
      seen.add(g);
      order.push(g);
    }
  }
  return order;
}

export function allGroupsLabel(lang: Lang): string {
  return translations[lang].lblAllGroups;
}

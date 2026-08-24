/**
 * Shared motion class tokens — paired with keyframes in index.css.
 * @license SPDX-License-Identifier: MIT
 */

export const zenMotion = {
  modalBackdropIn: "zen-motion-modal-backdrop-in",
  modalBackdropOut: "zen-motion-modal-backdrop-out",
  modalPanelIn: "zen-motion-modal-panel-in",
  modalPanelOut: "zen-motion-modal-panel-out",
  pop: "zen-motion-pop",
  popover: "zen-motion-popover",
  popoverVisible: "zen-motion-popover-visible",
  fadeIn: "zen-motion-fade-in",
  fadeInUp: "zen-motion-fade-in-up",
  fadeInUpDelayed: "zen-motion-fade-in-up-delayed",
  /** Staggered block on node detail mount — set `--zen-stagger-delay` inline. */
  detailSection: "zen-motion-detail-section",
  /** One-shot reveal after async chart / latency data finishes loading. */
  contentReveal: "zen-motion-content-reveal",
  /** Dashboard → instance detail route enter. */
  pageEnterForward: "zen-motion-page-enter-forward",
  /** Instance detail → dashboard route enter. */
  pageEnterBack: "zen-motion-page-enter-back",
  /** Sliding tab underline / segment pill. */
  slidingIndicator: "zen-motion-sliding-indicator",
  slidingPill: "zen-motion-sliding-pill",
  /** Sortable table header hover / active. */
  sortHeader: "zen-motion-sort-header",
  /** Dropdown / menu panel enter. */
  menuPanel: "zen-motion-menu-panel",
  card: "zen-motion-card",
  tooltip: "zen-motion-tooltip",
  tooltipVisible: "zen-motion-tooltip-visible",
} as const;

export function zenModalMotion(exiting: boolean) {
  return {
    backdrop: exiting ? zenMotion.modalBackdropOut : zenMotion.modalBackdropIn,
    panel: exiting ? zenMotion.modalPanelOut : zenMotion.modalPanelIn,
  };
}

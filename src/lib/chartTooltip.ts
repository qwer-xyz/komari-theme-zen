/** @license SPDX-License-Identifier: MIT */
type Box = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

/** Keep a chart tooltip beside its point and inside the visible viewport. */
export function chartTooltipPosition(anchor: Box, tooltip: Size, viewport: Size, xRatio: number, yRatio: number) {
  const margin = 12;
  const x = anchor.left + Math.max(0, Math.min(1, xRatio)) * anchor.width;
  const y = anchor.top + Math.max(0, Math.min(1, yRatio)) * anchor.height;
  const preferredX = x + tooltip.width + margin * 2 <= viewport.width
    ? x + margin : x - tooltip.width - margin;
  const preferredY = y - tooltip.height - margin >= margin
    ? y - tooltip.height - margin : y + margin;
  const clamp = (value: number, extent: number, size: number) =>
    Math.max(margin, Math.min(value, Math.max(margin, extent - size - margin)));
  return {
    left: clamp(preferredX, viewport.width, tooltip.width),
    top: clamp(preferredY, viewport.height, tooltip.height),
  };
}

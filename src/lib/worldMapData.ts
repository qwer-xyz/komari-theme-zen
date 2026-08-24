/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import raw from "@/assets/world-map-data.json";

export type WorldMapData = {
  w: number;
  h: number;
  /** Flat [x0, y0, x1, y1, …] in map pixel space */
  dots: number[];
  /** ISO 3166-1 alpha-2 → [x, y] in map pixel space */
  centroids: Record<string, [number, number]>;
};

export const worldMapData = raw as unknown as WorldMapData;

/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { useRef } from "react";
import {
  resolveRouteTransition,
  type RouteTransitionVariant,
} from "@/lib/routeTransition";

/** Derives enter animation direction when the pathname changes. */
export function useRouteTransition(pathname: string): RouteTransitionVariant {
  const previousPathRef = useRef(pathname);
  const variantRef = useRef<RouteTransitionVariant>("none");

  if (previousPathRef.current !== pathname) {
    variantRef.current = resolveRouteTransition(
      previousPathRef.current,
      pathname,
    );
    previousPathRef.current = pathname;
  }

  return variantRef.current;
}

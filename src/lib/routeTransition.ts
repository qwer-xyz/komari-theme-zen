/**
 * Route transition direction for dashboard ↔ instance detail navigation.
 * @license SPDX-License-Identifier: MIT
 */

export type RouteTransitionVariant = "forward" | "back" | "none";

const INSTANCE_PATH = /\/instance\/[^/]+/;

export function isInstanceRoute(pathname: string): boolean {
  return INSTANCE_PATH.test(pathname);
}

export function resolveRouteTransition(
  previousPath: string,
  nextPath: string,
): RouteTransitionVariant {
  if (previousPath === nextPath) return "none";

  const wasDetail = isInstanceRoute(previousPath);
  const isDetail = isInstanceRoute(nextPath);

  if (!wasDetail && isDetail) return "forward";
  if (wasDetail && !isDetail) return "back";
  return "none";
}

/**
 * Animated wrapper around the active route outlet.
 * @license SPDX-License-Identifier: MIT
 */

import { Outlet, useLocation } from "react-router-dom";
import { useRouteTransition } from "@/hooks/useRouteTransition";
import { zenMotion } from "@/lib/zenMotion";
import type { AppOutletContext } from "@/layouts/AppLayout";

type AnimatedOutletProps = {
  context: AppOutletContext;
};

const variantClass: Record<
  ReturnType<typeof useRouteTransition>,
  string
> = {
  forward: zenMotion.pageEnterForward,
  back: zenMotion.pageEnterBack,
  none: "",
};

export function AnimatedOutlet({ context }: AnimatedOutletProps) {
  const location = useLocation();
  const variant = useRouteTransition(location.pathname);
  const motionClass = variantClass[variant];

  return (
    <div
      key={location.pathname}
      className={`zen-page-transition-root ${motionClass}`.trim()}
    >
      <Outlet context={context} />
    </div>
  );
}

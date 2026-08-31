/**
 * Animated wrapper around the active route outlet.
 * @license SPDX-License-Identifier: MIT
 */

import { useEffect, useRef } from "react";
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
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      className={`zen-page-transition-root ${motionClass}`.trim()}
    >
      <Outlet context={context} />
    </div>
  );
}

/**
 * Mount / exit lifecycle for CSS-driven enter & leave animations.
 * @license SPDX-License-Identifier: MIT
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export const ZEN_MOTION_MODAL_EXIT_MS = 280;

export function useZenPresence(active: boolean, exitDurationMs = ZEN_MOTION_MODAL_EXIT_MS) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(active);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      setExiting(false);
      return;
    }

    if (!mounted) {
      setExiting(false);
      return;
    }

    if (reducedMotion) {
      setMounted(false);
      setExiting(false);
      return;
    }
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitDurationMs);

    return () => clearTimeout(timer);
  }, [active, exitDurationMs, mounted, reducedMotion]);

  return { mounted, exiting };
}

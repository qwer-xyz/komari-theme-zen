/**
 * Mount / exit lifecycle for CSS-driven enter & leave animations.
 * @license SPDX-License-Identifier: MIT
 */

import { useEffect, useRef, useState } from "react";

export const ZEN_MOTION_MODAL_EXIT_MS = 280;

export function useZenPresence(active: boolean, exitDurationMs = ZEN_MOTION_MODAL_EXIT_MS) {
  const [mounted, setMounted] = useState(active);
  const [exiting, setExiting] = useState(false);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      setMounted(true);
      setExiting(false);
      return;
    }

    if (!wasActiveRef.current) {
      return;
    }

    wasActiveRef.current = false;
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitDurationMs);

    return () => clearTimeout(timer);
  }, [active, exitDurationMs]);

  return { mounted, exiting };
}

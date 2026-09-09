/** @license SPDX-License-Identifier: MIT */
import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { resolveRouteTransition } from "@/lib/routeTransition";

/** Keep the old route (including its header) mounted until its short exit ends. */
export function useAnimatedRoute() {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(location);
  const rootRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const entering = useRef(0);
  const activeLocation = useRef(location);
  const previousDisplayed = useRef(displayed);

  useLayoutEffect(() => {
    if (location.pathname === displayed.pathname)
      activeLocation.current = location;
  }, [location, displayed.pathname]);

  useLayoutEffect(() => {
    if (location.pathname === displayed.pathname) return;
    const root = rootRef.current;
    const direction = resolveRouteTransition(
      displayed.pathname,
      location.pathname,
    );
    positions.current.set(activeLocation.current.key, window.scrollY);
    if (positions.current.size > 50) {
      positions.current.delete(positions.current.keys().next().value!);
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!root || reduced || direction === "none" || !root.animate) {
      entering.current = 0;
      setDisplayed(location);
      return;
    }
    let active = true;
    const sign = direction === "back" ? -1 : 1;
    const animation = root.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: `translateY(${-sign * 6}px)` },
      ],
      { duration: 110, easing: "ease-in", fill: "forwards" },
    );
    const finish = () => {
      if (!active) return;
      active = false;
      entering.current = sign;
      setDisplayed(location);
    };
    // Hidden webviews can suspend animation timelines; navigation must still finish.
    const timeout = window.setTimeout(finish, 160);
    void animation.finished.then(finish).catch(() => {});
    return () => {
      active = false;
      window.clearTimeout(timeout);
      animation.cancel();
    };
  }, [location, displayed]);

  useLayoutEffect(() => {
    if (previousDisplayed.current === displayed) return;
    previousDisplayed.current = displayed;
    // Restore before the first visible frame, including browser Back/Forward.
    window.scrollTo({
      top: positions.current.get(displayed.key) ?? 0,
      behavior: "instant",
    });
    const sign = entering.current;
    entering.current = 0;
    if (!sign || !rootRef.current) return;
    const animation = rootRef.current.animate(
      [
        { opacity: 0, transform: `translateY(${sign * 6}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 230,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      },
    );
    return () => animation.cancel();
  }, [displayed.pathname, displayed.key]);

  // Filters and pagination are immediate and must not replay page transitions.
  const routeLocation =
    location.pathname === displayed.pathname ? location : displayed;
  return { rootRef, routeLocation };
}

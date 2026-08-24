/**
 * Measures the active tab for a sliding underline / pill indicator.
 * @license SPDX-License-Identifier: MIT
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type SlidingRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function useSlidingIndicator(activeKey: string) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const [rect, setRect] = useState<SlidingRect | null>(null);

  const register = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) itemRefs.current.set(key, node);
      else itemRefs.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    const node = itemRefs.current.get(activeKey);
    if (!root || !node) {
      setRect(null);
      return;
    }

    const rootBox = root.getBoundingClientRect();
    const nodeBox = node.getBoundingClientRect();
    setRect({
      left: nodeBox.left - rootBox.left + root.scrollLeft,
      top: nodeBox.top - rootBox.top + root.scrollTop,
      width: nodeBox.width,
      height: nodeBox.height,
    });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();

    const root = rootRef.current;
    if (!root) return;

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    for (const el of itemRefs.current.values()) ro.observe(el);

    root.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      root.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [activeKey, measure]);

  return { rootRef, register, rect, measure };
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type CollectionPhase = "idle" | "leaving" | "entering";

const EXIT_MS = 140;
const ENTER_MS = 480;

export function useCollectionTransition<T>(items: T[], transitionKey: string) {
  const latestItemsRef = useRef(items);
  const committedKeyRef = useRef(transitionKey);
  const [displayedItems, setDisplayedItems] = useState(items);
  const [phase, setPhase] = useState<CollectionPhase>("idle");

  latestItemsRef.current = items;

  useLayoutEffect(() => {
    if (committedKeyRef.current === transitionKey) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      committedKeyRef.current = transitionKey;
      setDisplayedItems(latestItemsRef.current);
      setPhase("idle");
      return;
    }

    setPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      committedKeyRef.current = transitionKey;
      setDisplayedItems(latestItemsRef.current);
      setPhase("entering");
    }, EXIT_MS);

    return () => window.clearTimeout(swapTimer);
  }, [transitionKey]);

  useEffect(() => {
    if (phase !== "entering") return;
    const settleTimer = window.setTimeout(() => setPhase("idle"), ENTER_MS);
    return () => window.clearTimeout(settleTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "idle" || committedKeyRef.current !== transitionKey) return;
    setDisplayedItems(items);
  }, [items, phase, transitionKey]);

  const className =
    phase === "leaving"
      ? "zen-node-collection-leave"
      : phase === "entering"
        ? "zen-node-collection-enter"
        : "";

  return { displayedItems, className, transitioning: phase !== "idle" };
}

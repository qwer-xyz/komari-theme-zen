import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let nextModalId = 0;
const modalStack: number[] = [];
let lockCount = 0;
let previousOverflow = "";
let rootWasInert = false;

function lockBackground(): void {
  const root = document.getElementById("root");
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    rootWasInert = root?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;
  }
  lockCount += 1;
}

function unlockBackground(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  document.body.style.overflow = previousOverflow;
  const root = document.getElementById("root");
  if (root) root.inert = rootWasInert;
}

export function useModalA11y(
  active: boolean,
  onClose: () => void,
): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = ++nextModalId;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const id = idRef.current!;
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    modalStack.push(id);
    lockBackground();

    const focusDialog = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const first = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? dialog)?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener("keydown", onKeyDown, true);
      const stackIndex = modalStack.lastIndexOf(id);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      unlockBackground();
      const opener = openerRef.current;
      if (opener?.isConnected) {
        window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      }
    };
  }, [active]);

  return dialogRef;
}

/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { createPortal } from "react-dom";
import { MessageSquareText } from "lucide-react";
import { zenType } from "@/lib/typography";
import { zenBorder, zenInteractive, zenPopover, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";

interface PublicRemarkButtonProps {
  publicRemark?: string;
  privateRemark?: string;
  publicLabel: string;
  privateLabel: string;
  theme: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}

const VIEWPORT_PAD = 8;

function computePopoverCoords(
  trigger: HTMLElement,
  panel: HTMLElement,
): { top: number; left: number } {
  const tr = trigger.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const gap = 6;

  let left = tr.right - pw;
  let top = tr.top - ph - gap;

  if (left < VIEWPORT_PAD) {
    left = VIEWPORT_PAD;
  }
  if (left + pw > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - VIEWPORT_PAD - pw;
  }

  if (top < VIEWPORT_PAD) {
    top = tr.bottom + gap;
  }
  if (top + ph > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, tr.top - ph - gap);
  }

  return { top, left };
}

function RemarkSection({
  label,
  text,
  theme,
  withTopGap,
}: {
  label: string;
  text: string;
  theme: "light" | "dark";
  withTopGap?: boolean;
}) {
  return (
    <div className={withTopGap ? `mt-3 pt-3 border-t ${zenBorder.line}` : ""}>
      <div
        className={`mb-1.5 ${zenType.label} font-bold uppercase tracking-[0.2em] ${zenText.subtle}`}
      >
        {label}
      </div>
      <p className="whitespace-pre-wrap break-words normal-case">{text}</p>
    </div>
  );
}

export function PublicRemarkButton({
  publicRemark = "",
  privateRemark = "",
  publicLabel,
  privateLabel,
  theme,
  size = "sm",
  className = "",
}: PublicRemarkButtonProps) {
  const publicText = publicRemark.trim();
  const privateText = privateRemark.trim();
  if (!publicText && !privateText) return null;

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const [visible, setVisible] = React.useState(false);

  const iconSize = size === "sm" ? 13 : 15;

  const panelClass = zenPopover;

  const buttonClass = zenInteractive.iconIdle;

  const ariaLabel = [publicText && publicLabel, privateText && privateLabel]
    .filter(Boolean)
    .join(" / ");

  const reposition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    setCoords(computePopoverCoords(trigger, panel));
    setVisible(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    reposition();
  }, [open, publicText, privateText, reposition]);

  React.useEffect(() => {
    if (!open) return;
    const onReflow = () => reposition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, reposition]);

  const showPanel = () => setOpen(true);
  const hidePanel = () => setOpen(false);
  const togglePanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm p-0.5 focus:outline-none ${zenMotion.pop} ${buttonClass} ${className}`.trim()}
        onClick={togglePanel}
        onMouseEnter={showPanel}
        onMouseLeave={hidePanel}
        onFocus={showPanel}
        onBlur={hidePanel}
      >
        <MessageSquareText size={iconSize} strokeWidth={2} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
            }}
            className={`max-w-[min(320px,calc(100vw-16px))] rounded-sm px-3 py-2 font-mono ${zenType.caption} leading-relaxed tracking-wide ${panelClass} ${zenMotion.popover} ${visible ? `${zenMotion.popoverVisible} pointer-events-auto` : "pointer-events-none"}`}
            onMouseEnter={showPanel}
            onMouseLeave={hidePanel}
            onClick={(e) => e.stopPropagation()}
          >
            {publicText ? (
              <RemarkSection label={publicLabel} text={publicText} theme={theme} />
            ) : null}
            {privateText ? (
              <RemarkSection
                label={privateLabel}
                text={privateText}
                theme={theme}
                withTopGap={!!publicText}
              />
            ) : null}
          </div>,
          document.body,
        )}
    </>
  );
}

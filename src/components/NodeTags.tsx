/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { createPortal } from "react-dom";
import { parseNodeTags, type ParsedNodeTag } from "@/lib/parseNodeTags";
import {
  getTagOverflowTextClass,
  getTagSeparatorClass,
  getTagTextClass,
} from "@/lib/tagColorStyles";
import { zenPopover } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";

interface NodeTagsProps {
  tags: string;
  theme: "light" | "dark";
  size?: "sm" | "md" | "header";
  /** 最多展示几个，超出折叠为 +N；默认 2 */
  maxVisible?: number;
  /** Spaced " / " between tags (detail header). */
  spaced?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: "zen-type-caption md:tracking-[0.06em]",
  md: "zen-type-data md:tracking-[0.08em]",
  header: "text-sm tracking-wide",
} as const;

const VIEWPORT_PAD = 8;

function TagSeparator({
  theme,
  spaced = false,
}: {
  theme: "light" | "dark";
  spaced?: boolean;
}) {
  if (spaced) {
    return (
      <span
        className={`shrink-0 select-none font-mono text-sm font-light leading-none opacity-40 ${getTagSeparatorClass(theme)}`}
        aria-hidden
      >
        /
      </span>
    );
  }
  return (
    <span
      className={`select-none font-mono font-light ${getTagSeparatorClass(theme)}`}
      aria-hidden
    >
      /
    </span>
  );
}

function TagLabel({
  text,
  color,
  index,
  theme,
  sizeClass,
}: {
  text: string;
  color: ParsedNodeTag["color"];
  index: number;
  theme: "light" | "dark";
  sizeClass: string;
}) {
  return (
    <span
      title={text}
      className={`shrink-0 font-mono font-semibold leading-none ${sizeClass} ${getTagTextClass(color, index, theme)}`}
    >
      {text}
    </span>
  );
}

function TagList({
  items,
  theme,
  sizeClass,
  startIndex = 0,
  spaced = false,
}: {
  items: ParsedNodeTag[];
  theme: "light" | "dark";
  sizeClass: string;
  startIndex?: number;
  spaced?: boolean;
}) {
  return (
    <>
      {items.map(({ text, color }, index) => (
        <React.Fragment key={`${startIndex + index}-${text}`}>
          {index > 0 ? <TagSeparator theme={theme} spaced={spaced} /> : null}
          <TagLabel
            text={text}
            color={color}
            index={startIndex + index}
            theme={theme}
            sizeClass={sizeClass}
          />
        </React.Fragment>
      ))}
    </>
  );
}

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

function TagOverflow({
  hidden,
  hiddenCount,
  theme,
  sizeClass,
  startIndex,
  spaced = false,
}: {
  hidden: ParsedNodeTag[];
  hiddenCount: number;
  theme: "light" | "dark";
  sizeClass: string;
  startIndex: number;
  spaced?: boolean;
}) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const [visible, setVisible] = React.useState(false);

  const panelClass = zenPopover;

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
  }, [open, hidden, reposition]);

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

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex shrink-0 items-center"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={showPanel}
        onMouseLeave={hidePanel}
        onFocus={showPanel}
        onBlur={hidePanel}
      >
        <TagSeparator theme={theme} spaced={spaced} />
        <span
          className={`cursor-default font-mono font-semibold leading-none ${sizeClass} ${getTagOverflowTextClass(theme)} transition-colors`}
        >
          +{hiddenCount}
        </span>
      </span>
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
            className={`inline-flex max-w-[min(320px,calc(100vw-16px))] flex-wrap items-center gap-x-1 rounded-sm px-2 py-1 font-mono ${panelClass} ${zenMotion.popover} ${visible ? `${zenMotion.popoverVisible} pointer-events-auto` : "pointer-events-none"}`}
            onMouseEnter={showPanel}
            onMouseLeave={hidePanel}
          >
            <TagList
              items={hidden}
              theme={theme}
              sizeClass={sizeClass}
              startIndex={startIndex}
              spaced={spaced}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

export const NodeTags = React.memo(
  ({
    tags,
    theme,
    size = "sm",
    maxVisible = 2,
    spaced = false,
    className = "",
  }: NodeTagsProps) => {
    const parsed = parseNodeTags(tags);
    if (parsed.length === 0) {
      return null;
    }

    const sizeClass = SIZE_CLASS[size];
    const limit = maxVisible > 0 ? maxVisible : parsed.length;
    const visible = parsed.slice(0, limit);
    const hidden = parsed.slice(limit);
    const hiddenCount = hidden.length;

    return (
      <div
        className={`flex min-w-0 flex-row flex-wrap items-center ${
          spaced ? "gap-x-3 gap-y-1" : "gap-x-1 gap-y-0"
        } ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <TagList
          items={visible}
          theme={theme}
          sizeClass={sizeClass}
          spaced={spaced}
        />
        {hiddenCount > 0 ? (
          <TagOverflow
            hidden={hidden}
            hiddenCount={hiddenCount}
            theme={theme}
            sizeClass={sizeClass}
            startIndex={limit}
            spaced={spaced}
          />
        ) : null}
      </div>
    );
  },
);

NodeTags.displayName = "NodeTags";

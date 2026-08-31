/**
 * Tab row with a spring-animated sliding underline or pill indicator.
 * @license SPDX-License-Identifier: MIT
 */

import React, { forwardRef } from "react";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { zenMotion } from "@/lib/zenMotion";
import { zenInteractive } from "@/lib/zenSemantics";

export type ZenTabItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
  leading?: React.ReactNode;
};

type ZenTabControlProps = {
  tabs: ZenTabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill";
  className?: string;
  tabClassName?: string;
  activeClassName?: string;
  idleClassName?: string;
  indicatorClassName?: string;
  separator?: React.ReactNode;
  scrollable?: boolean;
  /** Sliding underline or pill highlight. Off for section-title style tabs. */
  showIndicator?: boolean;
  /** Accessible name for this mutually exclusive choice group. */
  ariaLabel?: string;
};

export const ZenTabControl = forwardRef<HTMLDivElement, ZenTabControlProps>(
  function ZenTabControl(
    {
      tabs,
      value,
      onChange,
      variant = "underline",
      className = "",
      tabClassName = "",
      activeClassName = "text-zen-accent font-black",
      idleClassName = "",
      indicatorClassName = "",
      separator,
      scrollable = false,
      showIndicator = true,
      ariaLabel,
    },
    forwardedRef,
  ) {
  const { rootRef, register, rect } = useSlidingIndicator(value);

  const indicator =
    showIndicator && rect && rect.width > 0 ? (
      <span
        aria-hidden
        className={
          variant === "pill"
            ? `pointer-events-none absolute z-0 rounded-full ${
                indicatorClassName ||
                "border border-zen-border-muted bg-zen-surface shadow-sm"
              } ${zenMotion.slidingPill}`
            : `pointer-events-none absolute z-0 bottom-0 h-0.5 rounded-full bg-zen-accent ${zenMotion.slidingIndicator}`
        }
        style={
          variant === "pill"
            ? {
                left: 0,
                top: 0,
                width: rect.width,
                height: rect.height,
                transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
              }
            : {
                left: 0,
                width: rect.width,
                transform: `translate3d(${rect.left}px, 0, 0)`,
              }
        }
      />
    ) : null;

  const scrollerClass = scrollable
    ? "overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "";

  const row = (
    <div
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative flex items-center ${scrollable ? "w-max gap-2 py-0.5 pr-3" : "gap-2"} ${className}`}
    >
      {indicator}
      {tabs.map((tab, index) => (
        <React.Fragment key={tab.id}>
          {index > 0 && separator ? (
            <span className="relative z-[1] select-none shrink-0" aria-hidden>
              {separator}
            </span>
          ) : null}
          <button
            type="button"
            ref={register(tab.id)}
            disabled={tab.disabled}
            aria-pressed={tab.id === value}
            data-group-active={
              scrollable && tab.id === value ? "true" : undefined
            }
            onClick={() => {
              if (!tab.disabled && tab.id !== value) onChange(tab.id);
            }}
            className={`relative z-[1] shrink-0 cursor-pointer transition-[color,transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${tabClassName} ${
              tab.id === value
                ? activeClassName
                : idleClassName || zenInteractive.tabIdle
            }`}
          >
            {tab.leading ? (
              <span className="inline-flex items-center gap-1.5">
                {tab.leading}
                {tab.label}
              </span>
            ) : (
              tab.label
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  if (!scrollable) return row;

  return (
    <div ref={forwardedRef} className={scrollerClass}>
      {row}
    </div>
  );
  },
);

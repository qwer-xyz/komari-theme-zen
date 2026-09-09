/** @license SPDX-License-Identifier: MIT */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { LANG_MENU_OPTIONS, type Lang } from "@/lib/i18n";
import { zenMotion } from "@/lib/zenMotion";

export function LanguageMenu({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = LANG_MENU_OPTIONS.findIndex(
    (option) => option.value === lang,
  );

  useLayoutEffect(() => {
    if (open) items.current[Math.max(0, selected)]?.focus();
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      ref={root}
      className="relative normal-case tracking-normal"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Language / 语言: ${LANG_MENU_OPTIONS[selected]?.label[lang]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`inline-flex min-h-10 max-w-[12rem] items-center gap-2 rounded-md px-2.5 font-bold text-zen-fg-strong transition-colors hover:bg-zen-elevate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-accent ${open ? "bg-zen-elevate text-zen-accent" : ""}`}
      >
        <span className="truncate">
          {LANG_MENU_OPTIONS[selected]?.label[lang]}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={13}
          className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label="Language / 语言"
          className={`absolute right-0 top-full z-[80] mt-1.5 w-48 max-w-[calc(100vw-2rem)] origin-top-right rounded-lg border border-zen-border bg-zen-surface p-1.5 font-mono text-sm shadow-lg ${zenMotion.menuPanel}`}
          onKeyDown={(event) => {
            const index = items.current.findIndex(
              (item) => item === document.activeElement,
            );
            let next: number | undefined;
            if (event.key === "ArrowDown")
              next = (index + 1) % LANG_MENU_OPTIONS.length;
            if (event.key === "ArrowUp")
              next =
                (index - 1 + LANG_MENU_OPTIONS.length) %
                LANG_MENU_OPTIONS.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = LANG_MENU_OPTIONS.length - 1;
            if (next !== undefined) {
              event.preventDefault();
              items.current[next]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          {LANG_MENU_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                items.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={lang === option.value}
              tabIndex={-1}
              onClick={() => {
                onChange(option.value);
                close();
              }}
              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left transition-colors hover:bg-zen-elevate focus:bg-zen-elevate focus:outline-none ${lang === option.value ? "font-bold text-zen-accent" : "text-zen-fg-strong"}`}
            >
              <span>{option.label[lang]}</span>
              {lang === option.value ? (
                <Check aria-hidden="true" size={14} className="shrink-0" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

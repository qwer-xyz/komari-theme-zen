/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { Suspense, lazy, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenText } from "@/lib/zenSemantics";
import { useZenPresence, ZEN_MOTION_MODAL_EXIT_MS } from "@/hooks/useZenPresence";
import { zenModalMotion, zenMotion } from "@/lib/zenMotion";
import type { NodeDistributionMapNode } from "@/components/NodeDistributionMap";

const NodeDistributionMap = lazy(() =>
  import("@/components/NodeDistributionMap").then((m) => ({
    default: m.NodeDistributionMap,
  })),
);

interface NodeDistributionMapModalProps {
  open: boolean;
  onClose: () => void;
  nodes: NodeDistributionMapNode[];
  theme: "light" | "dark";
  lang: Lang;
}

export function NodeDistributionMapModal({
  open,
  onClose,
  nodes,
  theme,
  lang,
}: NodeDistributionMapModalProps) {
  const t = translations[lang];
  const { mounted, exiting } = useZenPresence(open, ZEN_MOTION_MODAL_EXIT_MS);
  const motion = zenModalMotion(exiting);

  const requestClose = useCallback(() => {
    if (!exiting) onClose();
  }, [exiting, onClose]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, requestClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10">
      <button
        type="button"
        className={`absolute inset-0 bg-zen-bg/80 backdrop-blur-sm cursor-default ${motion.backdrop}`}
        aria-label={t.btnClose}
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-map-dialog-title"
        className={`relative z-10 flex w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[min(90vh,720px)] lg:max-h-[min(90vh,860px)] xl:max-h-[min(88vh,980px)] 2xl:max-h-[min(86vh,1100px)] flex-col overflow-hidden rounded-xl border ${zenBorder.default} bg-zen-surface shadow-2xl ${motion.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex shrink-0 items-center justify-between gap-4 border-b border-zen-line px-4 py-3 sm:px-5 sm:py-4 lg:px-7 lg:py-4 ${zenMotion.fadeInUp}`}>
          <h2
            id="node-map-dialog-title"
            className={`${zenType.section} zen-track-tight ${zenText.subtle} font-mono uppercase`}
          >
            {t.lblNodeDistribution}
          </h2>
          <button
            type="button"
            aria-label={t.btnClose}
            onClick={requestClose}
            className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zen-border-muted p-2 ${zenText.muted} hover:border-zen-accent/40 hover:text-zen-accent ${zenTouch.btn} ${zenMotion.pop} cursor-pointer`}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6 xl:px-8 xl:py-7 ${zenMotion.fadeInUpDelayed}`}>
          <Suspense fallback={null}>
            <NodeDistributionMap
              nodes={nodes}
              theme={theme}
              lang={lang}
              presentation="modal"
            />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
}

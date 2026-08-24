/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { VPSNode } from "@/types";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { HistoryRangeSelector } from "@/components/detail/HistoryRangeSelector";
import { useRecordSettings } from "@/hooks/useRecordSettings";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenText } from "@/lib/zenSemantics";
import { useZenPresence, ZEN_MOTION_MODAL_EXIT_MS } from "@/hooks/useZenPresence";
import { zenModalMotion, zenMotion } from "@/lib/zenMotion";

const LatencyProbePanel = lazy(() =>
  import("@/components/detail/LatencyProbePanel").then((m) => ({
    default: m.LatencyProbePanel,
  })),
);

interface LatencyProbeModalProps {
  open: boolean;
  onClose: () => void;
  node: VPSNode | null;
  theme: "light" | "dark";
  lang: Lang;
}

export function LatencyProbeModal({
  open,
  onClose,
  node,
  theme,
  lang,
}: LatencyProbeModalProps) {
  const t = translations[lang];
  const { pingPresets } = useRecordSettings();
  const { mounted, exiting } = useZenPresence(open, ZEN_MOTION_MODAL_EXIT_MS);
  const motion = zenModalMotion(exiting);

  const [selectedPingHours, setSelectedPingHours] = useState(
    () => pingPresets[0] ?? 1,
  );
  const [selectedProbes, setSelectedProbes] = useState<string[]>([]);
  const [isPingLoading, setIsPingLoading] = useState(false);
  const [displayNode, setDisplayNode] = useState<VPSNode | null>(null);

  const requestClose = useCallback(() => {
    if (!exiting) onClose();
  }, [exiting, onClose]);

  useEffect(() => {
    if (node) setDisplayNode(node);
  }, [node]);

  useEffect(() => {
    if (!open || !displayNode) return;
    setSelectedProbes([]);
    if (pingPresets.length > 0) {
      setSelectedPingHours(pingPresets[0]);
    }
  }, [open, displayNode?.id, pingPresets]);

  useEffect(() => {
    if (pingPresets.length === 0) return;
    if (!pingPresets.includes(selectedPingHours)) {
      setSelectedPingHours(pingPresets[0]);
    }
  }, [pingPresets, selectedPingHours]);

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

  const handleToggleProbe = (id: string) => {
    if (id === "CLEAR_ALL") {
      setSelectedProbes([]);
      return;
    }
    setSelectedProbes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handlePingRangeChange = (newHours: number) => {
    if (newHours === selectedPingHours || isPingLoading) return;
    setSelectedPingHours(newHours);
  };

  if (!mounted || !displayNode) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <button
        type="button"
        className={`absolute inset-0 bg-zen-bg/80 backdrop-blur-sm cursor-default ${motion.backdrop}`}
        aria-label={t.btnClose}
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="latency-probe-dialog-title"
        className={`relative z-10 flex w-full max-w-5xl lg:max-w-6xl max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-xl border ${zenBorder.default} bg-zen-surface shadow-2xl ${motion.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-center justify-between gap-4 border-b border-zen-line px-4 py-3 sm:px-5 sm:py-4 ${zenMotion.fadeInUp}`}
        >
          <div className="min-w-0">
            <h2
              id="latency-probe-dialog-title"
              className={`truncate ${zenType.section} zen-track-tight ${zenText.primary} font-mono`}
            >
              {displayNode.name}
            </h2>
            <p
              className={`mt-0.5 ${zenType.caption} ${zenText.subtle} font-mono uppercase zen-track-tight`}
            >
              {t.pingLatencyDetection}
            </p>
          </div>
          <button
            type="button"
            aria-label={t.btnClose}
            onClick={requestClose}
            className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zen-border-muted p-2 ${zenText.muted} hover:border-zen-accent/40 hover:text-zen-accent ${zenTouch.btn} ${zenMotion.pop} cursor-pointer`}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 ${zenMotion.fadeInUpDelayed}`}
        >
          <div className="mb-4 flex justify-start sm:justify-end">
            <HistoryRangeSelector
              presets={pingPresets}
              value={selectedPingHours}
              onChange={handlePingRangeChange}
              disabled={isPingLoading}
              theme={theme}
              messages={t}
            />
          </div>

          <div className="relative min-h-[28rem]">
            {isPingLoading ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center select-none bg-transparent pointer-events-none">
                <div
                  className={`px-4 py-2.5 ${zenType.caption} uppercase font-bold zen-track-tight font-mono flex items-center gap-2.5 border rounded-sm shadow-sm ${
                    theme === "dark"
                      ? "bg-zen-surface/95 border-zen-border-muted text-zen-accent"
                      : "bg-zen-surface/95 border-zen-border text-zen-accent"
                  }`}
                >
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-zen-accent"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t.loadingData}</span>
                </div>
              </div>
            ) : null}

            <Suspense fallback={null}>
              <LatencyProbePanel
                uuid={displayNode.id}
                hours={selectedPingHours}
                onLoadingChange={setIsPingLoading}
                selectedProbes={selectedProbes}
                onToggleProbe={handleToggleProbe}
                lang={lang}
                theme={theme}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

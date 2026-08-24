/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Lang, Messages } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { useZenPresence, ZEN_MOTION_MODAL_EXIT_MS } from "@/hooks/useZenPresence";
import {
  formatResidualCurrency,
  type ResidualExchangeRates,
  type ResidualValueExcludedNode,
  type ResidualValueReason,
  type ResidualValueSummary,
} from "@/lib/residualValue";
import { zenType, zenTouch } from "@/lib/typography";
import { zenBorder, zenText } from "@/lib/zenSemantics";
import { zenModalMotion, zenMotion } from "@/lib/zenMotion";

interface ResidualValueModalProps {
  open: boolean;
  onClose: () => void;
  summary: ResidualValueSummary;
  exchangeRates: ResidualExchangeRates | null;
  loading: boolean;
  error: string | null;
  lang: Lang;
}

function reasonLabel(reason: ResidualValueReason, messages: Messages): string {
  switch (reason) {
    case "free":
      return messages.residualReasonFree;
    case "no_price":
      return messages.residualReasonNoPrice;
    case "no_expiry":
      return messages.residualReasonNoExpiry;
    case "long_term":
      return messages.residualReasonLongTerm;
    case "unknown_currency":
      return messages.residualReasonUnknownCurrency;
    case "missing_rate":
      return messages.residualReasonMissingRate;
    default:
      return reason;
  }
}

function groupedExcluded(
  nodes: ResidualValueExcludedNode[],
  messages: Messages,
): Array<{
  reason: ResidualValueReason;
  label: string;
  count: number;
  nodes: ResidualValueExcludedNode[];
}> {
  const map = new Map<ResidualValueReason, ResidualValueExcludedNode[]>();
  for (const node of nodes) {
    const group = map.get(node.reason) ?? [];
    group.push(node);
    map.set(node.reason, group);
  }
  return [...map.entries()].map(([reason, groupedNodes]) => ({
    reason,
    label: reasonLabel(reason, messages),
    count: groupedNodes.length,
    nodes: groupedNodes,
  }));
}

function shouldShowExcludedDetails(reason: ResidualValueReason) {
  return reason === "unknown_currency" || reason === "missing_rate";
}

export function ResidualValueModal({
  open,
  onClose,
  summary,
  exchangeRates,
  loading,
  error,
  lang,
}: ResidualValueModalProps) {
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

  const locale = lang === "zh" ? "zh-CN" : lang;
  const exchangeSource = exchangeRates
    ? exchangeRates.fromCache
      ? `${exchangeRates.source} · ${t.residualExchangeCached}`
      : exchangeRates.source
    : t.residualExchangeUnavailable;
  const exchangeTime = exchangeRates
    ? new Date(exchangeRates.fetchedAt).toLocaleString()
    : "";
  const excludedGroups = groupedExcluded(summary.excludedNodes, t);
  const visibleIncluded = summary.includedNodes.slice(0, 8);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-2 sm:p-6 lg:p-8">
      <button
        type="button"
        className={`absolute inset-0 bg-zen-bg/80 backdrop-blur-sm cursor-default ${motion.backdrop}`}
        aria-label={t.btnClose}
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="residual-value-dialog-title"
        className={`relative z-10 flex w-full max-w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[min(92dvh,760px)] flex-col overflow-hidden rounded-lg sm:rounded-xl border ${zenBorder.default} bg-zen-surface shadow-2xl ${motion.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex shrink-0 items-start justify-between gap-3 border-b border-zen-line px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 ${zenMotion.fadeInUp}`}>
          <div className="min-w-0">
            <h2
              id="residual-value-dialog-title"
              className={`${zenType.section} zen-track-tight ${zenText.subtle} font-mono uppercase`}
            >
              {t.residualValueTitle}
            </h2>
            <p className={`${zenType.caption} mt-1 ${zenText.muted} font-mono normal-case`}>
              {t.residualValueSubtitle}
            </p>
          </div>
          <button
            type="button"
            aria-label={t.btnClose}
            onClick={requestClose}
            className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zen-border-muted p-1.5 sm:p-2 ${zenText.muted} hover:border-zen-accent/40 hover:text-zen-accent ${zenTouch.btn} ${zenMotion.pop} cursor-pointer`}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-5 ${zenMotion.fadeInUpDelayed}`}>
          <div className="grid grid-cols-[1.35fr_0.75fr_0.75fr] overflow-hidden rounded-md border border-zen-border-muted bg-zen-elevate/20 font-mono divide-x divide-zen-line">
            <div className="min-w-0 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <span className={`${zenType.label} zen-track-tight uppercase ${zenText.muted}`}>
                {t.residualTotal}
              </span>
              <span className={`mt-1 block truncate ${zenType.section} font-black ${zenText.primary}`}>
                {loading
                  ? t.loading
                  : formatResidualCurrency(
                      summary.totalValue,
                      summary.baseCurrency,
                      locale,
                    )}
              </span>
            </div>
            <div className="min-w-0 px-2.5 py-2.5 text-center sm:px-3 sm:py-3">
              <span className={`${zenType.label} zen-track-tight uppercase ${zenText.muted}`}>
                {t.residualIncluded}
              </span>
              <span className={`mt-1 block ${zenType.section} font-black ${zenText.primary}`}>
                {summary.includedCount}
              </span>
            </div>
            <div className="min-w-0 px-2.5 py-2.5 text-center sm:px-3 sm:py-3">
              <span className={`${zenType.label} zen-track-tight uppercase ${zenText.muted}`}>
                {t.residualExcluded}
              </span>
              <span className={`mt-1 block ${zenType.section} font-black ${zenText.primary}`}>
                {summary.excludedCount}
              </span>
            </div>
          </div>

          {error ? (
            <div className={`mt-4 rounded-md border border-zen-danger/30 bg-zen-danger/10 px-3 py-2 ${zenType.caption} font-mono text-zen-danger`}>
              {t.residualExchangeError}: {error}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="min-w-0">
              <h3 className={`${zenType.label} zen-track-tight uppercase ${zenText.muted} font-mono`}>
                {t.residualByCurrency}
              </h3>
              <div className="mt-2 divide-y divide-zen-line rounded-md border border-zen-border-muted overflow-hidden">
                {summary.currencyBuckets.length > 0 ? (
                  summary.currencyBuckets.map((bucket) => (
                    <div key={bucket.currencyCode} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2.5 font-mono">
                      <span className={`font-black ${zenText.primary}`}>
                        {bucket.currencyCode}
                      </span>
                      <span className={`text-right font-bold ${zenText.primary}`}>
                        {formatResidualCurrency(
                          bucket.convertedTotal,
                          summary.baseCurrency,
                          locale,
                        )}
                      </span>
                      <span className={`${zenType.caption} ${zenText.muted}`}>
                        {bucket.count} {t.residualNodesUnit}
                      </span>
                      <span className={`${zenType.caption} text-right ${zenText.muted}`}>
                        {formatResidualCurrency(
                          bucket.originalTotal,
                          bucket.currencyCode,
                          locale,
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={`px-3 py-4 text-center ${zenType.caption} ${zenText.muted} font-mono`}>
                    {loading ? t.loading : t.residualNoIncluded}
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0">
              <h3 className={`${zenType.label} zen-track-tight uppercase ${zenText.muted} font-mono`}>
                {t.residualNotIncluded}
              </h3>
              <div className="mt-2 divide-y divide-zen-line rounded-md border border-zen-border-muted overflow-hidden">
                {excludedGroups.length > 0 ? (
                  excludedGroups.map((item) => (
                    <div key={item.reason} className="font-mono">
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className={`${zenType.caption} ${zenText.muted}`}>
                          {item.label}
                        </span>
                        <span className={`font-bold ${zenText.primary}`}>
                          {item.count}
                        </span>
                      </div>
                      {shouldShowExcludedDetails(item.reason) ? (
                        <div className="space-y-1 px-3 pb-2.5">
                          {item.nodes.map((node) => (
                            <div
                              key={node.id}
                              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-sm bg-zen-elevate/20 px-2 py-1 ${zenType.micro}`}
                            >
                              <span className={`min-w-0 truncate ${zenText.muted}`}>
                                {node.name}
                              </span>
                              <span className={`shrink-0 font-bold ${zenText.primary}`}>
                                {node.currencyRaw || t.billingNotSet}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className={`px-3 py-4 text-center ${zenType.caption} ${zenText.muted} font-mono`}>
                    {t.residualNoneExcluded}
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-4 sm:mt-5">
            <h3 className={`${zenType.label} zen-track-tight uppercase ${zenText.muted} font-mono`}>
              {t.residualTopNodes}
            </h3>
            <div className="mt-2 divide-y divide-zen-line rounded-md border border-zen-border-muted overflow-hidden">
              {visibleIncluded.length > 0 ? (
                visibleIncluded.map((node) => (
                  <div key={node.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2.5 font-mono">
                    <span className={`min-w-0 truncate font-bold ${zenText.primary}`}>
                      {node.name}
                    </span>
                    <span className={`font-bold ${zenText.primary}`}>
                      {formatResidualCurrency(
                        node.convertedValue,
                        summary.baseCurrency,
                        locale,
                      )}
                    </span>
                    <span className={`${zenType.caption} ${zenText.muted}`}>
                      {node.daysRemaining} {t.unitDays}
                    </span>
                    <span className={`${zenType.caption} text-right ${zenText.muted}`}>
                      {formatResidualCurrency(
                        node.originalValue,
                        node.currencyCode,
                        locale,
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className={`px-3 py-4 text-center ${zenType.caption} ${zenText.muted} font-mono`}>
                  {loading ? t.loading : t.residualNoIncluded}
                </div>
              )}
            </div>
          </section>

          <div className={`mt-4 border-t border-zen-line pt-3 sm:mt-5 ${zenType.micro} ${zenText.faint} font-mono leading-relaxed`}>
            <div>{t.residualExchangeSource}: {exchangeSource}</div>
            {exchangeTime ? <div>{t.residualExchangeUpdated}: {exchangeTime}</div> : null}
            {exchangeRates?.source === "ExchangeRate-API" ? (
              <a
                href="https://www.exchangerate-api.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-zen-fg-faint hover:text-zen-accent underline underline-offset-2"
              >
                {t.residualExchangeAttribution}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import React from "react";
import type { VPSNode } from "@/types";
import {
  computeResidualValueSummary,
  loadResidualExchangeRates,
  normalizeCurrencyCode,
  normalizePrimaryCurrency,
  RESIDUAL_RATE_CACHE_TTL_MS,
  type ResidualExchangeRates,
  type ResidualValueSummary,
} from "@/lib/residualValue";

export type ResidualValueState = {
  summary: ResidualValueSummary;
  exchangeRates: ResidualExchangeRates | null;
  loading: boolean;
  error: string | null;
};

const emptySummary = (baseCurrency: string, enabled: boolean): ResidualValueSummary => ({
  enabled,
  baseCurrency,
  totalValue: 0,
  includedCount: 0,
  excludedCount: 0,
  includedNodes: [],
  excludedNodes: [],
  currencyBuckets: [],
});

export function useResidualValueSummary(
  nodes: VPSNode[],
  enabled: boolean,
  primaryCurrency: string,
): ResidualValueState {
  const baseCurrency = React.useMemo(
    () => normalizePrimaryCurrency(primaryCurrency),
    [primaryCurrency],
  );
  const [exchangeRates, setExchangeRates] =
    React.useState<ResidualExchangeRates | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const requiredCurrencyKey = React.useMemo(
    () =>
      [
        ...new Set(
          nodes
            .map((node) => normalizeCurrencyCode(node.currency))
            .filter((currency): currency is string => Boolean(currency)),
        ),
      ]
        .sort()
        .join(","),
    [nodes],
  );
  const requiredCurrencies = React.useMemo(
    () => (requiredCurrencyKey ? requiredCurrencyKey.split(",") : []),
    [requiredCurrencyKey],
  );

  React.useEffect(() => {
    if (!enabled) {
      setExchangeRates(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;
    setExchangeRates((current) =>
      current?.base === baseCurrency &&
      requiredCurrencies.every(
        (currency) =>
          currency === baseCurrency ||
          (Number.isFinite(current.rates[currency]) &&
            current.rates[currency] > 0),
      )
        ? current
        : null,
    );
    setLoading(true);
    setError(null);

    loadResidualExchangeRates(baseCurrency, requiredCurrencies)
      .then((rates) => {
        if (cancelled) return;
        setExchangeRates(rates);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setExchangeRates(null);
        setError(err?.message || "Failed to load exchange rates");
        retryTimer = window.setTimeout(
          () => setRefreshVersion((version) => version + 1),
          5 * 60_000,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [baseCurrency, enabled, refreshVersion, requiredCurrencies]);

  React.useEffect(() => {
    if (!enabled || !exchangeRates) return;
    const untilExpiry =
      exchangeRates.fetchedAt + RESIDUAL_RATE_CACHE_TTL_MS - Date.now();
    // An expired offline fallback should not create a one-second retry loop.
    const delay = untilExpiry > 0 ? untilExpiry + 1_000 : 5 * 60_000;
    const timer = window.setTimeout(
      () => setRefreshVersion((version) => version + 1),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, exchangeRates]);

  const summary = React.useMemo(() => {
    if (!enabled) return emptySummary(baseCurrency, false);
    if (
      !exchangeRates ||
      exchangeRates.base !== baseCurrency ||
      requiredCurrencies.some(
        (currency) =>
          currency !== baseCurrency &&
          (!Number.isFinite(exchangeRates.rates[currency]) ||
            exchangeRates.rates[currency] <= 0),
      )
    ) {
      return emptySummary(baseCurrency, true);
    }
    return computeResidualValueSummary(nodes, baseCurrency, exchangeRates.rates);
  }, [baseCurrency, enabled, exchangeRates, nodes, requiredCurrencies]);

  const activeExchangeRates =
    exchangeRates?.base === baseCurrency ? exchangeRates : null;

  return {
    summary,
    exchangeRates: activeExchangeRates,
    loading,
    error,
  };
}

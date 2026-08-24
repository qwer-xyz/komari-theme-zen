import React from "react";
import type { VPSNode } from "@/types";
import {
  computeResidualValueSummary,
  loadResidualExchangeRates,
  normalizeCurrencyCode,
  normalizePrimaryCurrency,
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseCurrency, enabled, requiredCurrencies]);

  const summary = React.useMemo(() => {
    if (!enabled) return emptySummary(baseCurrency, false);
    if (!exchangeRates) return emptySummary(baseCurrency, true);
    return computeResidualValueSummary(nodes, baseCurrency, exchangeRates.rates);
  }, [baseCurrency, enabled, exchangeRates, nodes]);

  return {
    summary,
    exchangeRates,
    loading,
    error,
  };
}

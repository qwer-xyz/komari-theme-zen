/** Komari node billing & expiry display (aligned with komari-web-radix PriceTags). */

export type ExpiryKind = "none" | "expired" | "long_term" | "active";

/** ~100 years — catches admin "set long-term" (+200 years). */
const LONG_TERM_DAYS_THRESHOLD = 36500;

export type ExpiryState = {
  kind: ExpiryKind;
  /** Days until expiry; 0 for expired/none, large value for long-term. */
  daysRemaining: number;
};

export type BillingLabels = {
  unitDays: string;
  billingFree: string;
  billingExpired: string;
  billingLongTerm: string;
  billingNoInfo: string;
  billingHidden: string;
  billingNotSet: string;
  billingMonthly: string;
  billingQuarterly: string;
  billingSemiAnnual: string;
  billingAnnual: string;
  billingBiennial: string;
  billingTriennial: string;
  billingQuinquennial: string;
  billingOnce: string;
  billingCycleDays: string;
};

export function isExpiryUnset(expiredAt: string | undefined): boolean {
  if (!expiredAt || expiredAt.trim() === "") return true;
  return expiredAt.startsWith("0001");
}

export function resolveExpiryState(expiredAt: string | undefined): ExpiryState {
  if (isExpiryUnset(expiredAt)) {
    return { kind: "none", daysRemaining: -1 };
  }

  const expiry = new Date(expiredAt!);
  if (Number.isNaN(expiry.getTime())) {
    return { kind: "none", daysRemaining: -1 };
  }

  const diffMs = expiry.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { kind: "expired", daysRemaining: 0 };
  }
  if (diffDays > LONG_TERM_DAYS_THRESHOLD) {
    return { kind: "long_term", daysRemaining: diffDays };
  }
  return { kind: "active", daysRemaining: diffDays };
}

/** Komari: price 0 = hide billing; -1 = free; >0 = show price. */
export function formatBillingCycleSuffix(
  billingCycle: number,
  labels: BillingLabels,
): string {
  if (billingCycle >= 27 && billingCycle <= 32) return labels.billingMonthly;
  if (billingCycle >= 87 && billingCycle <= 95) return labels.billingQuarterly;
  if (billingCycle >= 175 && billingCycle <= 185) return labels.billingSemiAnnual;
  if (billingCycle >= 360 && billingCycle <= 370) return labels.billingAnnual;
  if (billingCycle >= 720 && billingCycle <= 750) return labels.billingBiennial;
  if (billingCycle >= 1080 && billingCycle <= 1150) return labels.billingTriennial;
  if (billingCycle >= 1800 && billingCycle <= 1850) return labels.billingQuinquennial;
  if (billingCycle === -1) return labels.billingOnce;
  const days = billingCycle > 0 ? billingCycle : 30;
  return `${days}${labels.billingCycleDays}`;
}

export function formatPricePart(
  price: number,
  currency: string,
  billingCycle: number,
  labels: BillingLabels,
): string | null {
  if (price === 0) return null;
  const suffix = formatBillingCycleSuffix(billingCycle, labels);
  if (price === -1) {
    return `(${labels.billingFree})`;
  }
  return `(${currency}${price}/${suffix})`;
}

export function formatPriceLine(
  price: number,
  currency: string,
  billingCycle: number,
  labels: BillingLabels,
): string | null {
  if (price === 0) return null;
  const suffix = formatBillingCycleSuffix(billingCycle, labels);
  if (price === -1) return labels.billingFree;
  return `${currency}${price} / ${suffix}`;
}

function effectiveBillingCycleDays(billingCycle: number): number {
  return billingCycle > 0 ? billingCycle : 30;
}

function formatCurrencyAmount(currency: string, amount: number): string {
  const safeAmount = Math.max(0, amount);
  const text = safeAmount.toFixed(2).replace(/\.?0+$/, "");
  return `${currency}${text}`;
}

export function formatRemainingValue(
  node: NodeBillingInput,
  labels: BillingLabels,
): string | null {
  if (node.price === 0) return null;
  if (node.price === -1) return labels.billingFree;

  const expiry = resolveExpiryState(node.expiredAt);
  if (expiry.kind === "none") return null;
  if (expiry.kind === "expired") return formatCurrencyAmount(node.currency, 0);
  if (expiry.kind === "long_term") return null;
  if (node.billingCycle === -1) {
    return formatCurrencyAmount(node.currency, node.price);
  }

  const remainingValue =
    (node.price * expiry.daysRemaining) /
    effectiveBillingCycleDays(node.billingCycle);
  return formatCurrencyAmount(node.currency, remainingValue);
}

export type NodeBillingInput = {
  price: number;
  currency: string;
  billingCycle: number;
  expiredAt: string;
};

export type NodeBillingDisplay = {
  text: string;
  isExpired: boolean;
  isUrgent: boolean;
  expiryKind: ExpiryKind;
  daysRemaining: number;
};

export function formatNodeBilling(
  node: NodeBillingInput,
  labels: BillingLabels,
): NodeBillingDisplay {
  const expiry = resolveExpiryState(node.expiredAt);

  if (node.price === 0) {
    return {
      text: labels.billingNotSet,
      isExpired: false,
      isUrgent: false,
      expiryKind: "none",
      daysRemaining: -1,
    };
  }

  const pricePart = formatPricePart(
    node.price,
    node.currency,
    node.billingCycle,
    labels,
  );
  const hidden = `(${labels.billingHidden})`;

  switch (expiry.kind) {
    case "none":
      return {
        text: pricePart
          ? `${labels.billingNotSet} ${pricePart}`
          : labels.billingNotSet,
        isExpired: false,
        isUrgent: false,
        expiryKind: "none",
        daysRemaining: -1,
      };
    case "expired":
      return {
        text: `0 ${labels.unitDays} ${pricePart ?? hidden}`,
        isExpired: true,
        isUrgent: true,
        expiryKind: "expired",
        daysRemaining: 0,
      };
    case "long_term":
      return {
        text: `${labels.billingLongTerm} ${pricePart ?? hidden}`,
        isExpired: false,
        isUrgent: false,
        expiryKind: "long_term",
        daysRemaining: expiry.daysRemaining,
      };
    case "active":
    default:
      return {
        text: `${expiry.daysRemaining} ${labels.unitDays} ${pricePart ?? hidden}`,
        isExpired: false,
        isUrgent: expiry.daysRemaining <= 7,
        expiryKind: "active",
        daysRemaining: expiry.daysRemaining,
      };
  }
}

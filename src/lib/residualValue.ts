import type { VPSNode } from "@/types";
import { resolveExpiryState } from "@/lib/billingDisplay";

export type ResidualExchangeSource = "Frankfurter" | "ExchangeRate-API" | "Cache";

export type ResidualExchangeRates = {
  base: string;
  rates: Record<string, number>;
  source: Exclude<ResidualExchangeSource, "Cache">;
  fetchedAt: number;
  fromCache?: boolean;
};

export type ResidualValueReason =
  | "free"
  | "no_price"
  | "no_expiry"
  | "long_term"
  | "unknown_currency"
  | "missing_rate";

export type ResidualValueIncludedNode = {
  id: string;
  name: string;
  currencyRaw: string;
  currencyCode: string;
  originalValue: number;
  convertedValue: number;
  daysRemaining: number;
};

export type ResidualValueExcludedNode = {
  id: string;
  name: string;
  currencyRaw: string;
  reason: ResidualValueReason;
};

export type ResidualValueCurrencyBucket = {
  currencyCode: string;
  originalTotal: number;
  convertedTotal: number;
  count: number;
};

export type ResidualValueSummary = {
  enabled: boolean;
  baseCurrency: string;
  totalValue: number;
  includedCount: number;
  excludedCount: number;
  includedNodes: ResidualValueIncludedNode[];
  excludedNodes: ResidualValueExcludedNode[];
  currencyBuckets: ResidualValueCurrencyBucket[];
};

const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const FIAT_CODES = new Set([
  "AED",
  "ALL",
  "AMD",
  "ARS",
  "AUD",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BGN",
  "BHD",
  "BMD",
  "BND",
  "BOB",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CHF",
  "CLF",
  "CLP",
  "CNH",
  "COP",
  "CRC",
  "CUP",
  "CZK",
  "CNY",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "FOK",
  "GBP",
  "GEL",
  "GGP",
  "GHS",
  "GIP",
  "GTQ",
  "HKD",
  "HRK",
  "HTG",
  "HNL",
  "HUF",
  "IDR",
  "IQD",
  "IRR",
  "ILS",
  "IMP",
  "INR",
  "ISK",
  "JEP",
  "JMD",
  "JOD",
  "JPY",
  "KGS",
  "KES",
  "KHR",
  "KID",
  "KZT",
  "KWD",
  "KRW",
  "LAK",
  "LBP",
  "LKR",
  "LYD",
  "MAD",
  "MDL",
  "MKD",
  "MNT",
  "MOP",
  "MVR",
  "MXN",
  "MMK",
  "MUR",
  "MYR",
  "NIO",
  "NGN",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "SBD",
  "RON",
  "RSD",
  "RUB",
  "SAR",
  "SCR",
  "SEK",
  "SGD",
  "SRD",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TRY",
  "TTD",
  "TVD",
  "TZS",
  "TWD",
  "UAH",
  "UGX",
  "USD",
  "UZS",
  "UYU",
  "VES",
  "XCD",
  "XDR",
  "XPF",
  "VND",
  "XAF",
  "XOF",
  "ZAR",
  "ZMW",
  "ZWL",
  "AFN",
  "AOA",
  "ANG",
  "AWG",
  "BIF",
  "CDF",
  "CVE",
  "DJF",
  "ERN",
  "GMD",
  "GNF",
  "GYD",
  "KMF",
  "KYD",
  "LRD",
  "LSL",
  "MGA",
  "MRU",
  "MWK",
  "MZN",
  "NAD",
  "PGK",
  "RWF",
  "SDG",
  "SHP",
  "SLE",
  "SOS",
  "SSP",
  "STN",
  "SYP",
  "SZL",
  "TOP",
  "VUV",
  "WST",
  "YER",
]);

const CURRENCY_ALIASES: Array<[string, string]> = [
  ["US$", "USD"],
  ["U$S", "USD"],
  ["USD", "USD"],
  ["美元", "USD"],
  ["$US", "USD"],
  ["HK$", "HKD"],
  ["HKD", "HKD"],
  ["港币", "HKD"],
  ["港幣", "HKD"],
  ["MOP", "MOP"],
  ["澳门元", "MOP"],
  ["澳門元", "MOP"],
  ["NT$", "TWD"],
  ["NTD", "TWD"],
  ["TWD", "TWD"],
  ["新台币", "TWD"],
  ["新台幣", "TWD"],
  ["CN¥", "CNY"],
  ["CNH", "CNH"],
  ["CNY", "CNY"],
  ["RMB", "CNY"],
  ["人民币", "CNY"],
  ["人民幣", "CNY"],
  ["￥", "CNY"],
  ["¥", "CNY"],
  ["EUR", "EUR"],
  ["EURO", "EUR"],
  ["欧元", "EUR"],
  ["歐元", "EUR"],
  ["€", "EUR"],
  ["JP¥", "JPY"],
  ["JPY", "JPY"],
  ["日元", "JPY"],
  ["円", "JPY"],
  ["GBP", "GBP"],
  ["STERLING", "GBP"],
  ["英镑", "GBP"],
  ["英鎊", "GBP"],
  ["£", "GBP"],
  ["KRW", "KRW"],
  ["韩元", "KRW"],
  ["韓元", "KRW"],
  ["₩", "KRW"],
  ["SGD", "SGD"],
  ["S$", "SGD"],
  ["新加坡元", "SGD"],
  ["AUD", "AUD"],
  ["A$", "AUD"],
  ["澳元", "AUD"],
  ["澳币", "AUD"],
  ["澳幣", "AUD"],
  ["CAD", "CAD"],
  ["C$", "CAD"],
  ["加元", "CAD"],
  ["NZD", "NZD"],
  ["NZ$", "NZD"],
  ["CHF", "CHF"],
  ["瑞郎", "CHF"],
  ["瑞士法郎", "CHF"],
  ["SEK", "SEK"],
  ["NOK", "NOK"],
  ["DKK", "DKK"],
  ["ISK", "ISK"],
  ["PLN", "PLN"],
  ["ZŁ", "PLN"],
  ["CZK", "CZK"],
  ["HUF", "HUF"],
  ["FT", "HUF"],
  ["RON", "RON"],
  ["LEI", "RON"],
  ["BGN", "BGN"],
  ["ALL", "ALL"],
  ["HRK", "HRK"],
  ["BAM", "BAM"],
  ["MKD", "MKD"],
  ["MDL", "MDL"],
  ["RSD", "RSD"],
  ["TRY", "TRY"],
  ["₺", "TRY"],
  ["UAH", "UAH"],
  ["₴", "UAH"],
  ["RUB", "RUB"],
  ["₽", "RUB"],
  ["BYN", "BYN"],
  ["GEL", "GEL"],
  ["₾", "GEL"],
  ["AMD", "AMD"],
  ["AZN", "AZN"],
  ["₼", "AZN"],
  ["KZT", "KZT"],
  ["₸", "KZT"],
  ["KGS", "KGS"],
  ["UZS", "UZS"],
  ["TJS", "TJS"],
  ["TMT", "TMT"],
  ["THB", "THB"],
  ["฿", "THB"],
  ["MYR", "MYR"],
  ["RM", "MYR"],
  ["PHP", "PHP"],
  ["₱", "PHP"],
  ["IDR", "IDR"],
  ["RP", "IDR"],
  ["INR", "INR"],
  ["₹", "INR"],
  ["PKR", "PKR"],
  ["BDT", "BDT"],
  ["৳", "BDT"],
  ["LKR", "LKR"],
  ["NPR", "NPR"],
  ["MMK", "MMK"],
  ["KHR", "KHR"],
  ["LAK", "LAK"],
  ["MNT", "MNT"],
  ["₮", "MNT"],
  ["BND", "BND"],
  ["MVR", "MVR"],
  ["BTN", "BTN"],
  ["AFN", "AFN"],
  ["؋", "AFN"],
  ["BRL", "BRL"],
  ["R$", "BRL"],
  ["MXN", "MXN"],
  ["MEX$", "MXN"],
  ["ARS", "ARS"],
  ["AR$", "ARS"],
  ["CLP", "CLP"],
  ["CLF", "CLF"],
  ["COP", "COP"],
  ["PEN", "PEN"],
  ["UYU", "UYU"],
  ["BOB", "BOB"],
  ["PYG", "PYG"],
  ["₲", "PYG"],
  ["CRC", "CRC"],
  ["₡", "CRC"],
  ["DOP", "DOP"],
  ["GTQ", "GTQ"],
  ["HNL", "HNL"],
  ["NIO", "NIO"],
  ["PAB", "PAB"],
  ["BSD", "BSD"],
  ["BBD", "BBD"],
  ["BZD", "BZD"],
  ["JMD", "JMD"],
  ["TTD", "TTD"],
  ["XCD", "XCD"],
  ["AWG", "AWG"],
  ["ANG", "ANG"],
  ["KYD", "KYD"],
  ["BMD", "BMD"],
  ["HTG", "HTG"],
  ["GYD", "GYD"],
  ["SRD", "SRD"],
  ["CUP", "CUP"],
  ["VND", "VND"],
  ["₫", "VND"],
  ["AED", "AED"],
  ["د.إ", "AED"],
  ["SAR", "SAR"],
  ["﷼", "SAR"],
  ["QAR", "QAR"],
  ["KWD", "KWD"],
  ["BHD", "BHD"],
  ["OMR", "OMR"],
  ["ILS", "ILS"],
  ["₪", "ILS"],
  ["JOD", "JOD"],
  ["LBP", "LBP"],
  ["IQD", "IQD"],
  ["IRR", "IRR"],
  ["YER", "YER"],
  ["SYP", "SYP"],
  ["DZD", "DZD"],
  ["EGP", "EGP"],
  ["MAD", "MAD"],
  ["ZAR", "ZAR"],
  ["R", "ZAR"],
  ["NGN", "NGN"],
  ["₦", "NGN"],
  ["KES", "KES"],
  ["GHS", "GHS"],
  ["₵", "GHS"],
  ["TZS", "TZS"],
  ["UGX", "UGX"],
  ["ETB", "ETB"],
  ["ZMW", "ZMW"],
  ["BWP", "BWP"],
  ["MUR", "MUR"],
  ["SCR", "SCR"],
  ["NAD", "NAD"],
  ["LSL", "LSL"],
  ["SZL", "SZL"],
  ["RWF", "RWF"],
  ["BIF", "BIF"],
  ["CDF", "CDF"],
  ["DJF", "DJF"],
  ["ERN", "ERN"],
  ["GMD", "GMD"],
  ["GNF", "GNF"],
  ["LRD", "LRD"],
  ["LYD", "LYD"],
  ["MGA", "MGA"],
  ["MRU", "MRU"],
  ["MWK", "MWK"],
  ["MZN", "MZN"],
  ["AOA", "AOA"],
  ["CVE", "CVE"],
  ["KMF", "KMF"],
  ["SHP", "SHP"],
  ["SLE", "SLE"],
  ["SOS", "SOS"],
  ["SSP", "SSP"],
  ["STN", "STN"],
  ["SDG", "SDG"],
  ["TND", "TND"],
  ["XOF", "XOF"],
  ["XAF", "XAF"],
  ["FJD", "FJD"],
  ["FKP", "FKP"],
  ["FOK", "FOK"],
  ["GGP", "GGP"],
  ["GIP", "GIP"],
  ["IMP", "IMP"],
  ["JEP", "JEP"],
  ["KID", "KID"],
  ["PGK", "PGK"],
  ["SBD", "SBD"],
  ["VUV", "VUV"],
  ["WST", "WST"],
  ["TOP", "TOP"],
  ["TVD", "TVD"],
  ["XPF", "XPF"],
  ["VES", "VES"],
  ["XDR", "XDR"],
  ["ZWL", "ZWL"],
  ["$", "USD"],
];

export function normalizeCurrencyCode(raw: string | undefined): string | null {
  const text = (raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/＄/g, "$")
    .replace(/￥/g, "￥")
    .toUpperCase();
  if (!text) return null;

  const direct = CURRENCY_ALIASES.find(([alias]) => text === alias.toUpperCase());
  if (direct) return direct[1];

  const codeMatch = text.match(/[A-Z]{3}/);
  if (codeMatch && FIAT_CODES.has(codeMatch[0])) return codeMatch[0];

  const contained = CURRENCY_ALIASES.find(
    ([alias]) => alias.length > 1 && text.includes(alias.toUpperCase()),
  );
  if (contained) return contained[1];

  return null;
}

export function normalizePrimaryCurrency(raw: string | undefined): string {
  return normalizeCurrencyCode(raw) ?? "CNY";
}

function effectiveBillingCycleDays(billingCycle: number): number {
  return billingCycle > 0 ? billingCycle : 30;
}

function computeNodeResidualValue(node: VPSNode): number {
  const expiry = resolveExpiryState(node.expiredAt);
  if (expiry.kind === "expired") return 0;
  if (node.billingCycle === -1) return node.price;
  return (node.price * expiry.daysRemaining) / effectiveBillingCycleDays(node.billingCycle);
}

export function computeResidualValueSummary(
  nodes: VPSNode[],
  baseCurrency: string,
  exchangeRates: Record<string, number>,
): ResidualValueSummary {
  const includedNodes: ResidualValueIncludedNode[] = [];
  const excludedNodes: ResidualValueExcludedNode[] = [];
  const bucketMap = new Map<string, ResidualValueCurrencyBucket>();

  for (const node of nodes) {
    const currencyCode = normalizeCurrencyCode(node.currency);

    if (node.price === -1) {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "free",
      });
      continue;
    }

    if (!(node.price > 0)) {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "no_price",
      });
      continue;
    }

    const expiry = resolveExpiryState(node.expiredAt);
    if (expiry.kind === "none") {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "no_expiry",
      });
      continue;
    }

    if (expiry.kind === "long_term") {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "long_term",
      });
      continue;
    }

    if (!currencyCode) {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "unknown_currency",
      });
      continue;
    }

    const rate = currencyCode === baseCurrency ? 1 : exchangeRates[currencyCode];
    if (!Number.isFinite(rate) || rate <= 0) {
      excludedNodes.push({
        id: node.id,
        name: node.name,
        currencyRaw: node.currency,
        reason: "missing_rate",
      });
      continue;
    }

    const originalValue = computeNodeResidualValue(node);
    const convertedValue =
      currencyCode === baseCurrency ? originalValue : originalValue / rate;
    includedNodes.push({
      id: node.id,
      name: node.name,
      currencyRaw: node.currency,
      currencyCode,
      originalValue,
      convertedValue,
      daysRemaining: expiry.daysRemaining,
    });

    const bucket = bucketMap.get(currencyCode) ?? {
      currencyCode,
      originalTotal: 0,
      convertedTotal: 0,
      count: 0,
    };
    bucket.originalTotal += originalValue;
    bucket.convertedTotal += convertedValue;
    bucket.count += 1;
    bucketMap.set(currencyCode, bucket);
  }

  return {
    enabled: true,
    baseCurrency,
    totalValue: includedNodes.reduce((sum, node) => sum + node.convertedValue, 0),
    includedCount: includedNodes.length,
    excludedCount: excludedNodes.length,
    includedNodes: includedNodes.sort((a, b) => b.convertedValue - a.convertedValue),
    excludedNodes,
    currencyBuckets: [...bucketMap.values()].sort(
      (a, b) => b.convertedTotal - a.convertedTotal,
    ),
  };
}

function cacheKey(base: string) {
  return `komari-zen-residual-rates-${CACHE_VERSION}-${base}`;
}

function readCachedRates(base: string): ResidualExchangeRates | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(base));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResidualExchangeRates;
    if (
      parsed?.base !== base ||
      !parsed.rates ||
      typeof parsed.rates !== "object" ||
      !parsed.fetchedAt ||
      Date.now() - parsed.fetchedAt > CACHE_TTL_MS
    ) {
      return null;
    }
    return { ...parsed, fromCache: true };
  } catch {
    return null;
  }
}

function writeCachedRates(data: ResidualExchangeRates) {
  try {
    window.localStorage.setItem(cacheKey(data.base), JSON.stringify(data));
  } catch {
    // Cache is best-effort only.
  }
}

function hasRequiredRates(
  data: ResidualExchangeRates,
  requiredCurrencies: readonly string[],
): boolean {
  return requiredCurrencies.every(
    (currency) =>
      currency === data.base ||
      (Number.isFinite(data.rates[currency]) && data.rates[currency] > 0),
  );
}

async function fetchFrankfurterRates(base: string): Promise<ResidualExchangeRates> {
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}`,
  );
  if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
  const data = (await response.json()) as {
    base?: string;
    rates?: Record<string, number>;
  } | Array<{ quote?: string; rate?: number }>;
  const rates = Array.isArray(data)
    ? Object.fromEntries(
        data
          .filter(
            (item) =>
              typeof item.quote === "string" &&
              Number.isFinite(item.rate) &&
              (item.rate ?? 0) > 0,
          )
          .map((item) => [item.quote as string, item.rate as number]),
      )
    : data.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Invalid Frankfurter response");
  }
  return {
    base,
    rates,
    source: "Frankfurter",
    fetchedAt: Date.now(),
  };
}

async function fetchExchangeRateApiRates(base: string): Promise<ResidualExchangeRates> {
  const response = await fetch(
    `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
  );
  if (!response.ok) throw new Error(`ExchangeRate-API ${response.status}`);
  const data = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (data.result && data.result !== "success") {
    throw new Error(`ExchangeRate-API ${data.result}`);
  }
  if (!data.rates || typeof data.rates !== "object") {
    throw new Error("Invalid ExchangeRate-API response");
  }
  return {
    base,
    rates: data.rates,
    source: "ExchangeRate-API",
    fetchedAt: Date.now(),
  };
}

export async function loadResidualExchangeRates(
  baseCurrency: string,
  requiredCurrencies: readonly string[] = [],
): Promise<ResidualExchangeRates> {
  const base = normalizePrimaryCurrency(baseCurrency);
  const cached = readCachedRates(base);
  if (cached && hasRequiredRates(cached, requiredCurrencies)) return cached;

  let rates: ResidualExchangeRates | null = null;
  try {
    rates = await fetchFrankfurterRates(base);
    if (!hasRequiredRates(rates, requiredCurrencies)) {
      rates = await fetchExchangeRateApiRates(base);
    }
  } catch {
    // Fall through to the secondary open exchange-rate endpoint.
  }

  if (!rates) {
    rates = await fetchExchangeRateApiRates(base);
  }

  writeCachedRates(rates);
  return rates;
}

export function formatResidualCurrency(
  amount: number,
  currency: string,
  locale?: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const value = amount.toFixed(2).replace(/\.?0+$/, "");
    return `${currency} ${value}`;
  }
}

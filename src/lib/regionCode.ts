/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const REGIONAL_INDICATOR_START = 0x1f1e6;
const ASCII_ALPHA_START = 0x41;

/** Common Komari region labels → ISO 3166-1 alpha-2 */
const REGION_ALIASES: Record<string, string> = {
  香港: "HK",
  新加坡: "SG",
  澳门: "MO",
  澳門: "MO",
  台湾: "TW",
  臺灣: "TW",
  日本: "JP",
  韩国: "KR",
  韓國: "KR",
  美国: "US",
  美國: "US",
  英国: "GB",
  英國: "GB",
  德国: "DE",
  德國: "DE",
  法国: "FR",
  法國: "FR",
  荷兰: "NL",
  荷蘭: "NL",
  澳大利亚: "AU",
  澳洲: "AU",
  加拿大: "CA",
  中国: "CN",
  中國: "CN",
  "hong kong": "HK",
  singapore: "SG",
  macau: "MO",
  macao: "MO",
  taiwan: "TW",
  "united states": "US",
  "united kingdom": "GB",
};

function countryCodeFromFlagEmoji(emoji: string): string | null {
  const chars = Array.from(emoji);
  if (chars.length !== 2) return null;

  const codePoint1 = chars[0].codePointAt(0)!;
  const codePoint2 = chars[1].codePointAt(0)!;

  if (
    codePoint1 >= REGIONAL_INDICATOR_START &&
    codePoint1 <= 0x1f1ff &&
    codePoint2 >= REGIONAL_INDICATOR_START &&
    codePoint2 <= 0x1f1ff
  ) {
    const letter1 = String.fromCodePoint(
      codePoint1 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START,
    );
    const letter2 = String.fromCodePoint(
      codePoint2 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START,
    );
    return `${letter1}${letter2}`;
  }

  return null;
}

function resolveRegionAlias(flag: string): string | null {
  const trimmed = flag.trim();
  if (!trimmed) return null;

  const direct = REGION_ALIASES[trimmed];
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  return REGION_ALIASES[lower] ?? null;
}

/** Resolve Komari `region` / flag field to ISO 3166-1 alpha-2, or null if unknown. */
export function resolveCountryCode(flag: string): string | null {
  if (!flag || flag === "🌐" || flag === "🇺🇳") return null;

  const fromEmoji = countryCodeFromFlagEmoji(flag);
  if (fromEmoji) return fromEmoji;

  if (flag.length === 2 && /^[a-zA-Z]{2}$/.test(flag)) {
    return flag.toUpperCase();
  }

  return resolveRegionAlias(flag);
}

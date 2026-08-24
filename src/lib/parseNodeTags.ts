export const RADIX_TAG_COLORS = [
  "ruby",
  "gray",
  "gold",
  "bronze",
  "brown",
  "yellow",
  "amber",
  "orange",
  "tomato",
  "red",
  "crimson",
  "pink",
  "plum",
  "purple",
  "violet",
  "iris",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "jade",
  "green",
  "grass",
  "lime",
  "mint",
  "sky",
] as const;

export type RadixTagColor = (typeof RADIX_TAG_COLORS)[number];

export type ParsedNodeTag = {
  text: string;
  color: RadixTagColor | null;
};

const radixColorSet = new Set<string>(RADIX_TAG_COLORS);

function parseTagWithColor(tag: string): ParsedNodeTag {
  const colorMatch = tag.match(/<(\w+)>$/);
  if (colorMatch) {
    const color = colorMatch[1].toLowerCase();
    const text = tag.replace(/<\w+>$/, "");
    if (radixColorSet.has(color)) {
      return { text, color: color as RadixTagColor };
    }
  }
  return { text: tag, color: null };
}

export function parseNodeTags(raw: string): ParsedNodeTag[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw
    .split(";")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
    .map(parseTagWithColor);
}

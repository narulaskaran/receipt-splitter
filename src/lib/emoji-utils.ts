// Curated list of appropriate group emojis
const GROUP_EMOJIS = [
  // People & Groups
  "👥",
  "👪",
  "👫",
  "👬",
  "👭",
  "🧑‍🤝‍🧑",
  "👨‍👩‍👧‍👦",

  // Animals (Friendly)
  "🐶",
  "🐱",
  "🐻",
  "🐼",
  "🦊",
  "🦁",
  "🐸",
  "🐧",
  "🦄",
  "🐵",
  "🐯",
  "🐨",
  "🐮",
  "🐷",
  "🐭",
  "🐹",
  "🐰",
  "🦝",
  "🦎",
  "🐢",

  // Objects & Symbols
  "🌟",
  "⭐",
  "💎",
  "🎯",
  "🎨",
  "🎈",
  "🎪",
  "🎭",
  "🎵",
  "🎸",
  "⚽",
  "🏀",
  "🎾",
  "🏈",
  "🎳",
  "🎲",
  "♠️",
  "♥️",
  "♦️",
  "♣️",

  // Food & Fun
  "🍕",
  "🍰",
  "🎂",
  "🍻",
  "☕",
  "🍎",
  "🥕",
  "🍌",
  "🍓",
  "🍇",
  "🥑",
  "🌮",
  "🍔",
  "🍟",
  "🍿",
  "🧁",
  "🍪",
  "🍩",
  "🍧",
  "🍨",

  // Nature & Weather
  "🌸",
  "🌺",
  "🌻",
  "🌷",
  "🌹",
  "🌿",
  "🍀",
  "🌳",
  "🌲",
  "🌊",
  "⛄",
  "🌈",
  "☀️",
  "🌙",
  "⭐",
  "💫",
  "✨",
  "🔥",
  "❄️",
  "🌤️",

  // Transportation
  "🚗",
  "🚕",
  "🚙",
  "🚌",
  "🚎",
  "🏎️",
  "🚓",
  "🚑",
  "🚒",
  "🚐",
  "🛴",
  "🚲",
  "🛵",
  "🏍️",
  "✈️",
  "🚁",
  "🚢",
  "⛵",
  "🚀",
  "🛸",
];

/**
 * Get a random emoji from the curated list
 */
export function getRandomGroupEmoji(): string {
  const randomIndex = Math.floor(Math.random() * GROUP_EMOJIS.length);
  return GROUP_EMOJIS[randomIndex];
}

/**
 * Get a random emoji that's different from the provided emoji
 * Useful for regeneration
 */
export function getRandomGroupEmojiExcluding(excludeEmoji?: string): string {
  if (!excludeEmoji) {
    return getRandomGroupEmoji();
  }

  const availableEmojis = GROUP_EMOJIS.filter(
    (emoji) => emoji !== excludeEmoji
  );

  if (availableEmojis.length === 0) {
    // Fallback if somehow all emojis are excluded
    return getRandomGroupEmoji();
  }

  const randomIndex = Math.floor(Math.random() * availableEmojis.length);
  return availableEmojis[randomIndex];
}

/**
 * Get a unique emoji that's not already used by existing groups
 * Falls back to any random emoji if all are used
 */
export function getUniqueGroupEmoji(existingEmojis: string[] = []): string {
  const availableEmojis = GROUP_EMOJIS.filter(
    (emoji) => !existingEmojis.includes(emoji)
  );

  if (availableEmojis.length === 0) {
    // All emojis are used, fallback to random
    return getRandomGroupEmoji();
  }

  const randomIndex = Math.floor(Math.random() * availableEmojis.length);
  return availableEmojis[randomIndex];
}

/**
 * Get all available group emojis (for testing or display purposes)
 */
export function getAllGroupEmojis(): string[] {
  return [...GROUP_EMOJIS];
}

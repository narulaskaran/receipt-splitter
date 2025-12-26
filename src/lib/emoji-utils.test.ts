import {
  getRandomGroupEmoji,
  getRandomGroupEmojiExcluding,
  getUniqueGroupEmoji,
  getAllGroupEmojis,
} from './emoji-utils';

describe('getAllGroupEmojis', () => {
  it('returns a copy of the array, not the original', () => {
    const emojis1 = getAllGroupEmojis();
    const emojis2 = getAllGroupEmojis();

    expect(emojis1).not.toBe(emojis2); // Different references
    expect(emojis1).toEqual(emojis2); // Same content
  });

  it('contains no duplicates', () => {
    const emojis = getAllGroupEmojis();
    const uniqueEmojis = [...new Set(emojis)];
    expect(emojis.length).toBe(uniqueEmojis.length);
  });

  it('contains valid emoji strings', () => {
    const emojis = getAllGroupEmojis();
    emojis.forEach(emoji => {
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    });
  });
});

describe('getRandomGroupEmoji', () => {
  it('returns an emoji from the available list', () => {
    const emoji = getRandomGroupEmoji();
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });
});

describe('getRandomGroupEmojiExcluding', () => {
  it('returns an emoji from the available list', () => {
    const emoji = getRandomGroupEmojiExcluding('🐶');
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('returns different emoji than the excluded one', () => {
    const excluded = '🐶';

    // Call it multiple times to ensure it never returns the excluded emoji
    for (let i = 0; i < 20; i++) {
      const emoji = getRandomGroupEmojiExcluding(excluded);
      expect(emoji).not.toBe(excluded);
    }
  });

  it('handles exclusion of emoji not in the list', () => {
    const emoji = getRandomGroupEmojiExcluding('🦖'); // Not in the list
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });
});

describe('getUniqueGroupEmoji', () => {
  it('returns an emoji from the available list', () => {
    const emoji = getUniqueGroupEmoji();
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('returns an emoji not in the existing emojis list', () => {
    const existingEmojis = ['🐶', '🐱', '🐻'];

    for (let i = 0; i < 20; i++) {
      const emoji = getUniqueGroupEmoji(existingEmojis);
      expect(existingEmojis).not.toContain(emoji);
    }
  });

  it('handles empty existing emojis array', () => {
    const emoji = getUniqueGroupEmoji([]);
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('falls back to random emoji when all emojis are used', () => {
    const allEmojis = getAllGroupEmojis();

    // When all emojis are "used", it should still return one
    const emoji = getUniqueGroupEmoji(allEmojis);
    expect(typeof emoji).toBe('string');
    expect(emoji.length).toBeGreaterThan(0);
    expect(allEmojis).toContain(emoji);
  });

  it('progressively excludes more emojis correctly', () => {
    const existingEmojis: string[] = [];
    const allEmojis = getAllGroupEmojis();

    // Get unique emojis one by one
    for (let i = 0; i < 10; i++) {
      const emoji = getUniqueGroupEmoji(existingEmojis);
      expect(existingEmojis).not.toContain(emoji);
      expect(allEmojis).toContain(emoji);
      existingEmojis.push(emoji);
    }

    // All should be unique
    const uniqueSet = new Set(existingEmojis);
    expect(uniqueSet.size).toBe(10);
  });

  it('handles nearly exhausted emoji pool', () => {
    const allEmojis = getAllGroupEmojis();
    // Leave only 2 emojis available
    const existingEmojis = allEmojis.slice(0, -2);

    const emoji1 = getUniqueGroupEmoji(existingEmojis);
    expect(existingEmojis).not.toContain(emoji1);

    existingEmojis.push(emoji1);
    const emoji2 = getUniqueGroupEmoji(existingEmojis);
    expect(existingEmojis).not.toContain(emoji2);

    expect(emoji1).not.toBe(emoji2);
  });

  it('handles emojis not in the official list gracefully', () => {
    const existingEmojis = ['🦖', '🦕', '🐉']; // Not in the list

    const emoji = getUniqueGroupEmoji(existingEmojis);
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });
});

describe('emoji-utils integration', () => {
  it('all functions work together in a realistic scenario', () => {
    // Simulate creating multiple groups
    const groups: Array<{ id: string; emoji: string }> = [];

    // Create 10 groups with unique emojis
    for (let i = 0; i < 10; i++) {
      const existingEmojis = groups.map(g => g.emoji);
      const emoji = getUniqueGroupEmoji(existingEmojis);
      groups.push({ id: `group-${i}`, emoji });
    }

    // All emojis should be unique
    const emojiSet = new Set(groups.map(g => g.emoji));
    expect(emojiSet.size).toBe(10);

    // All should be valid
    const allEmojis = getAllGroupEmojis();
    groups.forEach(group => {
      expect(allEmojis).toContain(group.emoji);
    });
  });

  it('regenerating an emoji excludes the old one', () => {
    const oldEmoji = '🐶';

    // When regenerating, should exclude the old emoji
    for (let i = 0; i < 20; i++) {
      const newEmoji = getRandomGroupEmojiExcluding(oldEmoji);
      expect(newEmoji).not.toBe(oldEmoji);
    }
  });
});

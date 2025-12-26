import {
  getRandomGroupEmoji,
  getRandomGroupEmojiExcluding,
  getUniqueGroupEmoji,
  getAllGroupEmojis,
} from './emoji-utils';

describe('getAllGroupEmojis', () => {
  it('returns an array of emojis', () => {
    const emojis = getAllGroupEmojis();
    expect(Array.isArray(emojis)).toBe(true);
    expect(emojis.length).toBeGreaterThan(0);
  });

  it('returns a copy of the array, not the original', () => {
    const emojis1 = getAllGroupEmojis();
    const emojis2 = getAllGroupEmojis();

    expect(emojis1).not.toBe(emojis2); // Different references
    expect(emojis1).toEqual(emojis2); // Same content
  });

  it('returns at least 100 different emojis', () => {
    const emojis = getAllGroupEmojis();
    expect(emojis.length).toBeGreaterThanOrEqual(100);
  });

  it('contains only unique emojis', () => {
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
  it('returns a string', () => {
    const emoji = getRandomGroupEmoji();
    expect(typeof emoji).toBe('string');
  });

  it('returns an emoji from the available list', () => {
    const emoji = getRandomGroupEmoji();
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('returns different emojis over multiple calls (probabilistic)', () => {
    const emojis = new Set<string>();

    // Call it many times to get different results
    for (let i = 0; i < 50; i++) {
      emojis.add(getRandomGroupEmoji());
    }

    // Should have gotten at least a few different emojis
    expect(emojis.size).toBeGreaterThan(5);
  });

  it('always returns a non-empty string', () => {
    for (let i = 0; i < 10; i++) {
      const emoji = getRandomGroupEmoji();
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('getRandomGroupEmojiExcluding', () => {
  it('returns a string', () => {
    const emoji = getRandomGroupEmojiExcluding('🐶');
    expect(typeof emoji).toBe('string');
  });

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

  it('handles undefined exclusion by returning any emoji', () => {
    const emoji = getRandomGroupEmojiExcluding(undefined);
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('handles empty string exclusion by returning any emoji', () => {
    const emoji = getRandomGroupEmojiExcluding('');
    expect(typeof emoji).toBe('string');
    expect(emoji.length).toBeGreaterThan(0);
  });

  it('handles exclusion of emoji not in the list', () => {
    const emoji = getRandomGroupEmojiExcluding('🦖'); // Not in the list
    const allEmojis = getAllGroupEmojis();
    expect(allEmojis).toContain(emoji);
  });

  it('returns different emojis over multiple calls (probabilistic)', () => {
    const emojis = new Set<string>();

    for (let i = 0; i < 50; i++) {
      emojis.add(getRandomGroupEmojiExcluding('🐶'));
    }

    expect(emojis.size).toBeGreaterThan(5);
    expect(emojis.has('🐶')).toBe(false);
  });

  it('still returns an emoji even when excluding the last one (edge case)', () => {
    // This tests the fallback behavior
    const allEmojis = getAllGroupEmojis();
    const lastEmoji = allEmojis[allEmojis.length - 1];

    const emoji = getRandomGroupEmojiExcluding(lastEmoji);
    expect(typeof emoji).toBe('string');
    expect(emoji.length).toBeGreaterThan(0);
  });
});

describe('getUniqueGroupEmoji', () => {
  it('returns a string', () => {
    const emoji = getUniqueGroupEmoji();
    expect(typeof emoji).toBe('string');
  });

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

  it('handles undefined existing emojis', () => {
    const emoji = getUniqueGroupEmoji();
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

  it('returns different unique emojis for multiple calls', () => {
    const existingEmojis = ['🐶'];
    const uniqueEmojis = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const emoji = getUniqueGroupEmoji(existingEmojis);
      uniqueEmojis.add(emoji);
    }

    // Should have gotten several different emojis
    expect(uniqueEmojis.size).toBeGreaterThan(5);
    // None should be the excluded one
    expect(uniqueEmojis.has('🐶')).toBe(false);
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
    const existingEmojis = ['🐱', '🐻'];

    // When regenerating, should exclude both the old emoji and existing ones
    for (let i = 0; i < 20; i++) {
      const newEmoji = getRandomGroupEmojiExcluding(oldEmoji);
      expect(newEmoji).not.toBe(oldEmoji);
    }
  });
});

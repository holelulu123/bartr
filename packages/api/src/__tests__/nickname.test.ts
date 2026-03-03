import { describe, it, expect } from 'vitest';
import { ADJECTIVES, NOUNS, generateNickname, totalCombinations } from '../lib/nickname';

describe('Nickname word lists', () => {
  it('has no overlap between ADJECTIVES and NOUNS', () => {
    const overlap = ADJECTIVES.filter((w) => NOUNS.includes(w));
    expect(overlap).toEqual([]);
  });

  it('has no duplicates within ADJECTIVES', () => {
    const dupes = ADJECTIVES.filter((w, i) => ADJECTIVES.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });

  it('has no duplicates within NOUNS', () => {
    const dupes = NOUNS.filter((w, i) => NOUNS.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });

  it('generates nicknames matching Adjective + Noun + 0-999 pattern', () => {
    for (let i = 0; i < 50; i++) {
      const nick = generateNickname();
      const match = nick.match(/^([A-Z][a-z]+)([A-Z][a-z]+)(\d+)$/);
      expect(match).not.toBeNull();
      expect(ADJECTIVES).toContain(match![1]);
      expect(NOUNS).toContain(match![2]);
      const num = parseInt(match![3], 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThan(1000);
    }
  });

  it('reports correct total combinations', () => {
    expect(totalCombinations()).toBe(ADJECTIVES.length * NOUNS.length * 1000);
  });
});

import { describe, it, expect } from 'vitest';
import { ADJECTIVES, NOUNS1, NOUNS2 } from '../lib/nickname';

describe('Nickname word lists', () => {
  it('has no overlap between ADJECTIVES and NOUNS1', () => {
    const overlap = ADJECTIVES.filter((w) => NOUNS1.includes(w));
    expect(overlap).toEqual([]);
  });

  it('has no overlap between ADJECTIVES and NOUNS2', () => {
    const overlap = ADJECTIVES.filter((w) => NOUNS2.includes(w));
    expect(overlap).toEqual([]);
  });

  it('has no overlap between NOUNS1 and NOUNS2', () => {
    const overlap = NOUNS1.filter((w) => NOUNS2.includes(w));
    expect(overlap).toEqual([]);
  });

  it('has no duplicates within ADJECTIVES', () => {
    const dupes = ADJECTIVES.filter((w, i) => ADJECTIVES.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });

  it('has no duplicates within NOUNS1', () => {
    const dupes = NOUNS1.filter((w, i) => NOUNS1.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });

  it('has no duplicates within NOUNS2', () => {
    const dupes = NOUNS2.filter((w, i) => NOUNS2.indexOf(w) !== i);
    expect(dupes).toEqual([]);
  });
});

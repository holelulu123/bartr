import type { Pool } from 'pg';

const ADJECTIVES = [
  'Bold', 'Calm', 'Dark', 'Eager', 'Fast', 'Free', 'Gold', 'Grim', 'Hard', 'Idle',
  'Iron', 'Jade', 'Just', 'Keen', 'Kind', 'Late', 'Lone', 'Lost', 'Mild', 'Mute',
  'Neat', 'Noir', 'Null', 'Odd', 'Open', 'Pale', 'Pure', 'Rare', 'Rich', 'Rust',
  'Safe', 'Sage', 'Slim', 'Slow', 'Smart', 'Solar', 'Still', 'Stone', 'Storm', 'Sure',
  'Swift', 'Tall', 'Tame', 'Tidy', 'True', 'Vast', 'Void', 'Warm', 'Wild', 'Wise',
  'Zero', 'Zen', 'Amber', 'Azure', 'Blaze', 'Brave', 'Brief', 'Crisp', 'Cyber', 'Dense',
  'Dusty', 'Early', 'Elder', 'Empty', 'Epic', 'Exact', 'Faint', 'Fiery', 'Final', 'Fixed',
  'Flash', 'Float', 'Fluid', 'Forge', 'Formal', 'Frosted', 'Frozen', 'Fuzzy', 'Ghost', 'Giant',
  'Gloom', 'Glow', 'Grand', 'Grave', 'Gray', 'Green', 'Grim', 'Harsh', 'Heavy', 'Hidden',
  'High', 'Hollow', 'Honest', 'Huge', 'Humble', 'Hyper', 'Inky', 'Jade', 'Krypt', 'Laser',
  'Latent', 'Lavish', 'Lean', 'Lunar', 'Magic', 'Major', 'Matte', 'Micro', 'Mighty', 'Mint',
  'Misty', 'Modern', 'Molten', 'Mono', 'Mystic', 'Narrow', 'Native', 'Neon', 'Nimble', 'Noble',
  'Nova', 'Null', 'Ocean', 'Onyx', 'Optic', 'Orbit', 'Outer', 'Oxide', 'Pixel', 'Plain',
  'Plasma', 'Plated', 'Polar', 'Primal', 'Prism', 'Prompt', 'Proud', 'Proxy', 'Quantum', 'Quiet',
  'Quick', 'Radiant', 'Raven', 'Raw', 'Red', 'Remote', 'Rigid', 'Rogue', 'Royal', 'Rugged',
  'Sacred', 'Sandy', 'Savage', 'Sharp', 'Signal', 'Silent', 'Silver', 'Sleek', 'Smoke', 'Solid',
  'Sonic', 'Stale', 'Stark', 'Static', 'Steady', 'Steep', 'Stiff', 'Strange', 'Strong', 'Subtle',
  'Surge', 'Sword', 'Teal', 'Tense', 'Thin', 'Titan', 'Token', 'Toxic', 'Ultra', 'Unique',
  'Urban', 'Violet', 'Viral', 'Visual', 'Vivid', 'Voltaic', 'Wavy', 'White', 'Windy', 'Wired',
];

const NOUNS = [
  'Arc', 'Ash', 'Atom', 'Axe', 'Bay', 'Bear', 'Bird', 'Blade', 'Block', 'Bolt',
  'Bond', 'Bone', 'Book', 'Buck', 'Bull', 'Byte', 'Cave', 'Chain', 'Chip', 'Claw',
  'Clone', 'Cloud', 'Code', 'Coin', 'Core', 'Crane', 'Creek', 'Crow', 'Crown', 'Cube',
  'Cycle', 'Dark', 'Dawn', 'Deck', 'Deer', 'Delta', 'Dome', 'Dune', 'Dust', 'Eagle',
  'Edge', 'Epoch', 'Falcon', 'Fang', 'Fiber', 'Field', 'Flame', 'Flash', 'Flux', 'Focus',
  'Forge', 'Fork', 'Fox', 'Frame', 'Frost', 'Gate', 'Ghost', 'Giant', 'Glyph', 'Grid',
  'Grove', 'Guard', 'Guild', 'Hawk', 'Hash', 'Helix', 'Hive', 'Hook', 'Horn', 'Hull',
  'Hunter', 'Index', 'Isle', 'Jade', 'Jaguar', 'Key', 'Kind', 'Lake', 'Lance', 'Layer',
  'Leaf', 'Ledger', 'Light', 'Link', 'Lion', 'Lock', 'Loop', 'Lynx', 'Mask', 'Mesa',
  'Mesh', 'Mine', 'Mint', 'Mirror', 'Mode', 'Moon', 'Moth', 'Mount', 'Musk', 'Nexus',
  'Night', 'Node', 'North', 'Oath', 'Ocean', 'Orbit', 'Otter', 'Owl', 'Pact', 'Peak',
  'Peer', 'Pike', 'Pilot', 'Pine', 'Pixel', 'Plain', 'Plane', 'Prism', 'Probe', 'Pulse',
  'Quark', 'Quest', 'Rail', 'Raven', 'Realm', 'Ridge', 'Ring', 'River', 'Rock', 'Root',
  'Route', 'Rune', 'Sage', 'Scout', 'Shard', 'Shark', 'Shell', 'Shield', 'Shore', 'Signal',
  'Slate', 'Smoke', 'Snake', 'Snow', 'Spark', 'Spire', 'Stack', 'Star', 'Storm', 'Surge',
  'Swan', 'Sword', 'Tide', 'Tiger', 'Token', 'Torch', 'Tower', 'Trace', 'Track', 'Tree',
  'Tribe', 'Tusk', 'Vault', 'Vector', 'Veil', 'Viper', 'Void', 'Volt', 'Wave', 'Wolf',
  'Wood', 'Wyrm', 'Yak', 'Zero', 'Zone', 'Zephyr',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSuffix(): number {
  return Math.floor(Math.random() * 900) + 10; // 10–909
}

export function generateNickname(): string {
  return `${randomItem(ADJECTIVES)}${randomItem(NOUNS)}${randomSuffix()}`;
}

/**
 * Generate a nickname guaranteed to be unique in the DB.
 * Tries up to 10 random combinations, then falls back to incrementing the suffix.
 */
export async function generateUniqueNickname(pg: Pool): Promise<string> {
  // Try up to 10 random nicknames first
  for (let i = 0; i < 10; i++) {
    const candidate = generateNickname();
    const { rows } = await pg.query('SELECT 1 FROM users WHERE nickname = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }

  // Fallback: pick a base and increment suffix until free
  const adj = randomItem(ADJECTIVES);
  const noun = randomItem(NOUNS);
  let suffix = randomSuffix();
  for (let i = 0; i < 1000; i++) {
    const candidate = `${adj}${noun}${suffix + i}`;
    const { rows } = await pg.query('SELECT 1 FROM users WHERE nickname = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }

  // Extremely unlikely to reach here, but safe fallback
  return `${adj}${noun}${Date.now()}`;
}

import type { Pool } from 'pg';

// ── Adjectives (≤5 chars, 456 words) ────────────────────────────────────────
const ADJECTIVES = [
  'Able', 'Adept', 'Aged', 'Agile', 'Aglow',
  'Aloft', 'Aloof', 'Ample', 'Antic', 'Arid',
  'Askew', 'Avid', 'Balmy', 'Bare', 'Bleak',
  'Bluff', 'Blunt', 'Bold', 'Brash', 'Brave',
  'Briny', 'Brisk', 'Broad', 'Brute', 'Burly',
  'Burnt', 'Caged', 'Calm', 'Catty', 'Chewy',
  'Chill', 'Civic', 'Civil', 'Clad', 'Cleft',
  'Cold', 'Cool', 'Cozy', 'Crisp', 'Crude',
  'Curly', 'Cyan', 'Damp', 'Dark', 'Dead',
  'Deep', 'Dense', 'Dingy', 'Dire', 'Dowdy',
  'Drear', 'Drawn', 'Dual', 'Dull', 'Dumpy',
  'Dusty', 'Dusky', 'Dyed', 'Early', 'Ebon',
  'Edgy', 'Eerie', 'Elder', 'Elfin', 'Elite',
  'Empty', 'Epic', 'Even', 'Exact', 'Faded',
  'Faint', 'Fair', 'Fast', 'Fell', 'Feral',
  'Fiery', 'Fine', 'Firm', 'Fizzy', 'Fixed',
  'Fleet', 'Fluid', 'Foggy', 'Fond', 'Foul',
  'Frail', 'Frank', 'Free', 'Fresh', 'Full',
  'Fuzzy', 'Gamey', 'Gaudy', 'Gaunt', 'Gawky',
  'Ghost', 'Giant', 'Giddy', 'Gold', 'Gone',
  'Good', 'Gray', 'Green', 'Grim', 'Gross',
  'Gusty', 'Hard', 'Harsh', 'Hazy', 'Heavy',
  'High', 'Hoary', 'Hokey', 'Holy', 'Huge',
  'Humid', 'Husky', 'Hyper', 'Icy', 'Idle',
  'Inert', 'Inky', 'Inner', 'Irate', 'Jazzy',
  'Jolly', 'Juicy', 'Jumbo', 'Jumpy', 'Just',
  'Keen', 'Kind', 'Lanky', 'Large', 'Late',
  'Lazy', 'Lean', 'Lithe', 'Livid', 'Loamy',
  'Lofty', 'Lone', 'Long', 'Loopy', 'Loose',
  'Lost', 'Loud', 'Lowly', 'Lucid', 'Lunar',
  'Lurid', 'Lush', 'Lusty', 'Mad', 'Magic',
  'Major', 'Mangy', 'Matte', 'Meek', 'Mild',
  'Mired', 'Misty', 'Mossy', 'Mousy', 'Mucky',
  'Muddy', 'Murky', 'Musty', 'Mute', 'Naked',
  'Neon', 'New', 'Nifty', 'Nippy', 'Noble',
  'Noir', 'Noted', 'Nubby', 'Nutty', 'Oaken',
  'Odd', 'Oily', 'Olden', 'Olive', 'Open',
  'Optic', 'Pagan', 'Pale', 'Pasty', 'Perky',
  'Picky', 'Pithy', 'Plump', 'Podgy', 'Pouty',
  'Pudgy', 'Puffy', 'Pulpy', 'Punky', 'Pure',
  'Quick', 'Quiet', 'Rangy', 'Rare', 'Ratty',
  'Raw', 'Razed', 'Real', 'Reedy', 'Regal',
  'Rich', 'Rigid', 'Risen', 'Risky', 'Rocky',
  'Rogue', 'Roomy', 'Rosy', 'Rough', 'Rowdy',
  'Royal', 'Ruddy', 'Runic', 'Rusty', 'Safe',
  'Sage', 'Salty', 'Sandy', 'Sappy', 'Savvy',
  'Scaly', 'Seamy', 'Seedy', 'Shady', 'Sharp',
  'Sheer', 'Shy', 'Silky', 'Silty', 'Sixth',
  'Sleek', 'Slick', 'Slim', 'Slimy', 'Slow',
  'Smart', 'Smoky', 'Snaky', 'Snowy', 'Soft',
  'Soggy', 'Spare', 'Spicy', 'Spiky', 'Spiny',
  'Staid', 'Stark', 'Steep', 'Stern', 'Stiff',
  'Still', 'Stoic', 'Stony', 'Stout', 'Stray',
  'Sulky', 'Sure', 'Surly', 'Tacky', 'Tame',
  'Tangy', 'Tardy', 'Taut', 'Tawny', 'Teal',
  'Tepid', 'Terse', 'Tense', 'Testy', 'Thick',
  'Thin', 'Tidy', 'Tight', 'Timid', 'Tipsy',
  'Tiny', 'Torn', 'Tough', 'Trite', 'Tubby',
  'True', 'Ugly', 'Unlit', 'Vague', 'Vain',
  'Vapid', 'Vast', 'Veiny', 'Vexed', 'Viral',
  'Vivid', 'Wacky', 'Warm', 'Wavy', 'Waspy',
  'Weary', 'Weedy', 'Wild', 'Wimpy', 'Windy',
  'Wire', 'Wise', 'Witty', 'Woozy', 'Wormy',
  'Worn', 'Woven', 'Wry', 'Zany', 'Zero',
  'Zesty', 'Zippy', 'Acrid', 'Algid', 'Amber',
  'Amiss', 'Angry', 'Antsy', 'Apish', 'Artsy',
  'Ashen', 'Atilt', 'Balky', 'Bandy', 'Barky',
  'Batty', 'Beady', 'Blowy', 'Boggy', 'Boney',
  'Boozy', 'Bossy', 'Bulgy', 'Bumpy', 'Bushy',
  'Campy', 'Chary', 'Civvy', 'Clchy', 'Cloky',
  'Cobby', 'Coldy', 'Comfy', 'Corny', 'Crass',
  'Dirty', 'Ditzy', 'Dizzy', 'Dodgy', 'Doggy',
  'Dopey', 'Dotty', 'Downy', 'Ducky', 'Duffy',
  'Elmy', 'Fancy', 'Fatty', 'Fenny', 'Ferny',
  'Fetid', 'Filmy', 'Flaxy', 'Flowy', 'Fluky',
  'Foamy', 'Funky', 'Girly', 'Glum', 'Gooey',
  'Gruff', 'Gummy', 'Hairy', 'Handy', 'Happy',
  'Hardy', 'Hasty', 'Heady', 'Hippy', 'Itchy',
  'Kinky', 'Leaky', 'Lousy', 'Lucky', 'Lumpy',
  'Lushy', 'Messy', 'Milky', 'Minty', 'Moldy',
  'Muggy', 'Mushy', 'Needy', 'Nerdy', 'Noisy',
  'Normy', 'Panty', 'Peaky', 'Peaty', 'Peppy',
  'Pervy', 'Petty', 'Piney', 'Pixy', 'Pliny',
  'Porky', 'Potty', 'Prim', 'Privy', 'Prude',
  'Racy', 'Rainy', 'Ready', 'Resin', 'Rimy',
  'Rindy', 'Rippy', 'Ritzy', 'Rushy', 'Sassy',
  'Saucy', 'Shaky', 'Soppy', 'Soupy', 'Squat',
  'Stale', 'Sudsy', 'Sunny', 'Tarry', 'Tasty',
  'Tatty', 'Teary', 'Tinny', 'Tippy', 'Toxic',
  'Vainy', 'Vampy', 'Viny', 'Vixy', 'Waxen',
  'Wiggy', 'Wispy', 'Woody', 'Wordy', 'Wussy',
  'Zingy'
];

// ── Noun bank 1 — materials / elements / forces (≤5 chars, 353 words) ──────────
const NOUNS1 = [
  'Acid', 'Aeon', 'Aero', 'Alloy', 'Alum',
  'Ambit', 'Anion', 'Apex', 'Argon', 'Arson',
  'Atlas', 'Atom', 'Aura', 'Axle', 'Axon',
  'Balsa', 'Beam', 'Bevel', 'Blaze', 'Bloom',
  'Bone', 'Borax', 'Brawn', 'Brine', 'Broth',
  'Brume', 'Burn', 'Byte', 'Cable', 'Canal',
  'Carat', 'Chalk', 'Chaos', 'Char', 'Chard',
  'Chasm', 'Chart', 'Chert', 'Cinch', 'Clay',
  'Clast', 'Coal', 'Copal', 'Core', 'Craft',
  'Creek', 'Crest', 'Crown', 'Crumb', 'Crust',
  'Crux', 'Crypt', 'Culm', 'Cumin', 'Cycle',
  'Datum', 'Decal', 'Delta', 'Depth', 'Dew',
  'Diode', 'Draft', 'Dregs', 'Drone', 'Dune',
  'Dust', 'Ebb', 'Edge', 'Ember', 'Epoch',
  'Ether', 'Event', 'Expel', 'Exon', 'Fault',
  'Ferro', 'Fiber', 'Field', 'Filth', 'Firth',
  'Flare', 'Flash', 'Flax', 'Fleck', 'Flint',
  'Flood', 'Flow', 'Flux', 'Foam', 'Focus',
  'Forge', 'Frass', 'Frost', 'Fuel', 'Fume',
  'Fumes', 'Gale', 'Gamma', 'Gate', 'Gauss',
  'Gel', 'Gild', 'Glare', 'Glass', 'Glow',
  'Glyph', 'Grain', 'Grid', 'Grime', 'Grind',
  'Gruel', 'Gulf', 'Halo', 'Halon', 'Haul',
  'Haze', 'Heat', 'Helix', 'Hertz', 'Hull',
  'Hum', 'Humus', 'Hydra', 'Ignis', 'Ingot',
  'Ionic', 'Ivory', 'Jolt', 'Karat', 'Kelp',
  'Kiln', 'Klang', 'Knell', 'Larch', 'Lava',
  'Layer', 'Lead', 'Leach', 'Lemma', 'Light',
  'Lime', 'Loam', 'Lode', 'Loess', 'Lumen',
  'Macro', 'Magma', 'Mana', 'Marsh', 'Meld',
  'Metal', 'Micro', 'Mist', 'Moat', 'Mono',
  'Moult', 'Mote', 'Mud', 'Myrrh', 'Nadir',
  'Nexus', 'Nitro', 'Node', 'Noise', 'Nova',
  'Notch', 'Ocean', 'Ochre', 'Onyx', 'Orbit',
  'Ore', 'Oxide', 'Ozone', 'Patch', 'Peat',
  'Petal', 'Phase', 'Pixel', 'Plait', 'Plasm',
  'Plate', 'Plume', 'Point', 'Pulse', 'Pyro',
  'Quake', 'Quark', 'Rain', 'Raze', 'Realm',
  'Ridge', 'Rift', 'Rune', 'Rust', 'Salt',
  'Sand', 'Scald', 'Seam', 'Shard', 'Shell',
  'Sigma', 'Silt', 'Slag', 'Sleet', 'Slope',
  'Smear', 'Smelt', 'Smite', 'Smolt', 'Smoke',
  'Snow', 'Sonic', 'Soot', 'Sound', 'Spall',
  'Spark', 'Spine', 'Split', 'Spore', 'Spray',
  'Sprue', 'Stack', 'Steam', 'Stone', 'Storm',
  'Straw', 'Strut', 'Surge', 'Swamp', 'Swath',
  'Sweep', 'Swift', 'Synth', 'Taper', 'Tempo',
  'Tenor', 'Terra', 'Thorn', 'Tide', 'Tine',
  'Titan', 'Topaz', 'Torch', 'Toxin', 'Trace',
  'Trail', 'Triac', 'Trine', 'Trode', 'Truth',
  'Tuft', 'Tuner', 'Turbo', 'Twill', 'Twist',
  'Umbra', 'Unify', 'Unity', 'Valor', 'Valve',
  'Vaunt', 'Vein', 'Visor', 'Volt', 'Volta',
  'Wane', 'Warp', 'Waste', 'Water', 'Wave',
  'Weave', 'Weld', 'Whirl', 'Wind', 'Wisp',
  'Wood', 'Wrack', 'Wrath', 'Wreck', 'Xeno',
  'Xylem', 'Yield', 'Yoke', 'Zinc', 'Zone',
  'Allyl', 'Amble', 'Anvil', 'Basin', 'Batch',
  'Blot', 'Blur', 'Brink', 'Caulk', 'Chord',
  'Cord', 'Creak', 'Crimp', 'Cull', 'Dirge',
  'Drill', 'Drip', 'Drop', 'Dross', 'Flume',
  'Gleam', 'Gloss', 'Grout', 'Gulp', 'Gust',
  'Heave', 'Hook', 'Husk', 'Knot', 'Ledge',
  'Latch', 'Lingo', 'Lobe', 'Loft', 'Lore',
  'Lump', 'Lurk', 'Mast', 'Mesh', 'Mold',
  'Murk', 'Nymph', 'Parch', 'Peak', 'Plank',
  'Polar', 'Pool', 'Rack', 'Reed', 'Reef',
  'Reign', 'Rend', 'Rile', 'Rope', 'Roost',
  'Rung', 'Sheen', 'Slab', 'Slate', 'Smock',
  'Snare', 'Spool', 'Spout', 'Stave', 'Tack',
  'Tally', 'Vapor', 'Wick'
];

// ── Noun bank 2 — animals / creatures / objects (≤5 chars, 303 words) ──────────
const NOUNS2 = [
  'Adder', 'Agama', 'Agave', 'Algae', 'Aloe',
  'Ape', 'Asp', 'Auk', 'Avian', 'Bison',
  'Boar', 'Buck', 'Bug', 'Bull', 'Burro',
  'Carp', 'Cat', 'Chub', 'Clam', 'Cobra',
  'Cod', 'Coney', 'Croc', 'Crow', 'Cub',
  'Culex', 'Dace', 'Deer', 'Dingo', 'Dodo',
  'Dog', 'Dove', 'Drake', 'Duck', 'Eagle',
  'Egret', 'Eland', 'Elk', 'Emu', 'Fawn',
  'Finch', 'Fish', 'Flea', 'Fly', 'Foal',
  'Fox', 'Frog', 'Gator', 'Gaur', 'Gecko',
  'Genet', 'Gila', 'Gnu', 'Goat', 'Grebe',
  'Grub', 'Gull', 'Hare', 'Hawk', 'Heron',
  'Hind', 'Hippo', 'Hound', 'Hyena', 'Ibex',
  'Ibis', 'Imp', 'Jay', 'Kea', 'Kite',
  'Kiwi', 'Kudu', 'Lark', 'Leech', 'Lemur',
  'Liger', 'Lion', 'Loon', 'Lynx', 'Mamba',
  'Mink', 'Mite', 'Mole', 'Moose', 'Moth',
  'Mouse', 'Mule', 'Mutt', 'Newt', 'Okapi',
  'Oryx', 'Otter', 'Owl', 'Ox', 'Panda',
  'Perch', 'Pike', 'Pipit', 'Pony', 'Puma',
  'Quail', 'Quoll', 'Ram', 'Rat', 'Raven',
  'Ray', 'Rhino', 'Rook', 'Ruff', 'Saiga',
  'Seal', 'Shark', 'Shrew', 'Skink', 'Skua',
  'Slug', 'Smew', 'Snail', 'Snake', 'Snipe',
  'Stag', 'Stoat', 'Stork', 'Swan', 'Tapir',
  'Tern', 'Tiger', 'Toad', 'Trout', 'Tuna',
  'Viper', 'Vole', 'Wasp', 'Whelk', 'Wolf',
  'Wren', 'Yak', 'Zebra', 'Axe', 'Barb',
  'Barge', 'Baron', 'Baton', 'Beak', 'Beast',
  'Berth', 'Bilge', 'Birch', 'Blade', 'Board',
  'Brace', 'Brand', 'Brood', 'Brush', 'Buoy',
  'Burr', 'Cairn', 'Canid', 'Canon', 'Cavy',
  'Celt', 'Chain', 'Chunk', 'Club', 'Conch',
  'Crane', 'Crook', 'Cross', 'Crush', 'Cusp',
  'Dale', 'Dart', 'Disk', 'Divot', 'Drape',
  'Dray', 'Dread', 'Drum', 'Duvet', 'Dwarf',
  'Fang', 'Fern', 'Flag', 'Flair', 'Flank',
  'Flock', 'Floe', 'Floss', 'Fluke', 'Flute',
  'Flask', 'Frame', 'Frond', 'Froth', 'Gavel',
  'Girth', 'Gnome', 'Grail', 'Gripe', 'Guard',
  'Guild', 'Gyre', 'Haft', 'Hank', 'Hasp',
  'Haven', 'Hazel', 'Helm', 'Hemp', 'Hilt',
  'Hinge', 'Hoard', 'Hulk', 'Hutch', 'Index',
  'Inset', 'Joust', 'Keel', 'Keep', 'Knave',
  'Knob', 'Lance', 'Lath', 'Liege', 'Limb',
  'Lodge', 'Mace', 'Match', 'Maul', 'Maze',
  'Mound', 'Mount', 'Paean', 'Pall', 'Parry',
  'Pearl', 'Peel', 'Pelt', 'Pile', 'Pinch',
  'Pitch', 'Plane', 'Pouch', 'Prow', 'Puck',
  'Purse', 'Quill', 'Rasp', 'Relic', 'Rivet',
  'Scamp', 'Scout', 'Spade', 'Spear', 'Spur',
  'Staff', 'Stake', 'Strap', 'Token', 'Truss',
  'Vault', 'Wagon', 'Wedge', 'Winch', 'Arch',
  'Arrow', 'Badge', 'Bench', 'Bower', 'Bract',
  'Brook', 'Broom', 'Bugle', 'Bunk', 'Catch',
  'Clamp', 'Clasp', 'Cliff', 'Clog', 'Creel',
  'Cress', 'Croup', 'Fyrd', 'Gorse', 'Hithe',
  'Joist', 'Knoll', 'Lathe', 'Loom', 'Pedal',
  'Quoin', 'Scull', 'Shank', 'Sheaf', 'Shoal',
  'Sieve', 'Skiff', 'Thill', 'Thole', 'Tong',
  'Weald', 'Wharf', 'Woad'
];

// ── Helpers ────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSuffix(): number {
  return Math.floor(Math.random() * 100); // 0–99
}

export function generateNickname(): string {
  return `${randomItem(ADJECTIVES)}${randomItem(NOUNS1)}${randomItem(NOUNS2)}${randomSuffix()}`;
}

/**
 * Generate a nickname guaranteed to be unique in the DB.
 * Tries up to 10 random combinations, then falls back to incrementing the suffix.
 */
export async function generateUniqueNickname(pg: Pool): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generateNickname();
    const { rows } = await pg.query('SELECT 1 FROM users WHERE nickname = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }

  // Fallback: fix adj+noun1+noun2, walk the suffix space then beyond
  const adj = randomItem(ADJECTIVES);
  const n1 = randomItem(NOUNS1);
  const n2 = randomItem(NOUNS2);
  for (let i = 0; i < 10000; i++) {
    const candidate = `${adj}${n1}${n2}${i}`;
    const { rows } = await pg.query('SELECT 1 FROM users WHERE nickname = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }

  return `${adj}${n1}${n2}${Date.now()}`;
}

export function totalCombinations(): number {
  return ADJECTIVES.length * NOUNS1.length * NOUNS2.length * 100;
}

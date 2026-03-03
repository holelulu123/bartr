import type { Pool } from 'pg';

export const ADJECTIVES: string[] = [
  'Able', 'Acid', 'Aged', 'Alive', 'Angry', 'Awful', 'Awake',
  'Back', 'Bad', 'Bald', 'Bare', 'Basic', 'Beefy', 'Big', 'Black',
  'Blank', 'Blind', 'Blond', 'Blue', 'Blunt', 'Bold', 'Bony', 'Born', 'Bossy', 'Both',
  'Brave', 'Brief', 'Broad', 'Brown', 'Brute', 'Buff', 'Bumpy', 'Burnt', 'Bushy', 'Busy',
  'Calm', 'Cheap', 'Chewy', 'Chief', 'Civil', 'Clean', 'Clear', 'Close', 'Cold', 'Comfy',
  'Cool', 'Coral', 'Corny', 'Cozy', 'Crazy', 'Crisp', 'Cross', 'Crude', 'Cruel', 'Curly',
  'Curvy', 'Cute', 'Daily', 'Damp', 'Dark', 'Dead', 'Deaf', 'Dear', 'Deep', 'Dense',
  'Dim', 'Dirty', 'Dizzy', 'Done', 'Dorky', 'Down', 'Dry', 'Dual', 'Dull', 'Dumb',
  'Dusty', 'Each', 'Eager', 'Early', 'Easy', 'Edgy', 'Eight', 'Elder', 'Elite', 'Empty',
  'Equal', 'Even', 'Every', 'Evil', 'Exact', 'Extra', 'Epic', 'Faint', 'Fair', 'Fake',
  'Fancy', 'Far', 'Fast', 'Fat', 'Fatal', 'Fatty', 'Final',
  'Fine', 'Firm', 'First', 'Fit', 'Fixed', 'Fizzy', 'Flaky', 'Flat', 'Fleet', 'Foamy',
  'Foggy', 'Fond', 'Fore', 'Foul', 'Free', 'Fresh', 'Front', 'Froze', 'Full', 'Fun',
  'Funny', 'Fuzzy', 'Gassy', 'Geeky', 'Giant', 'Giddy', 'Glad', 'Glum', 'Gold', 'Good',
  'Goofy', 'Grand', 'Gray', 'Great', 'Green', 'Grey', 'Grim', 'Gross',
  'Grown', 'Hairy', 'Half', 'Handy', 'Happy', 'Hard', 'Harsh', 'Hasty',
  'Hazy', 'Heavy', 'Hefty', 'High', 'Hilly', 'Holy', 'Hot', 'Huge', 'Human', 'Humid',
  'Hurt', 'Husky', 'Icy', 'Idle', 'Inner', 'Itchy', 'Jazzy', 'Joint', 'Jolly',
  'Juicy', 'Just', 'Kind', 'Large', 'Last', 'Late', 'Lazy', 'Leafy', 'Lean',
  'Left', 'Legal', 'Less', 'Level', 'Light', 'Limp', 'Live', 'Local', 'Lone', 'Long',
  'Loose', 'Lost', 'Loud', 'Low', 'Lower', 'Lucky', 'Lumpy', 'Lunar', 'Mad', 'Magic',
  'Main', 'Major', 'Male', 'Many', 'Mean', 'Messy', 'Metal', 'Mild', 'Milky',
  'Mini', 'Minor', 'Minty', 'Misty', 'Mixed', 'Moist', 'Moody', 'Moral', 'More', 'Most',
  'Much', 'Muddy', 'Mushy', 'Mute', 'Naive', 'Nasty', 'Naval', 'Navy', 'Near',
  'Neat', 'Needy', 'Nerdy', 'New', 'Next', 'Nice', 'Noble', 'Noisy', 'North',
  'Numb', 'Nutty', 'Odd', 'Oily', 'Old', 'Only', 'Open', 'Other', 'Outer', 'Oval',
  'Over', 'Own', 'Pale', 'Past', 'Perky', 'Petty', 'Picky', 'Pink', 'Plain', 'Plump',
  'Plus', 'Polar', 'Poor', 'Prime', 'Prior', 'Proud', 'Puffy', 'Pure', 'Quick', 'Quiet',
  'Rainy', 'Rapid', 'Rare', 'Raw', 'Ready', 'Real', 'Red', 'Rich', 'Rigid',
  'Risky', 'Rocky', 'Roomy', 'Rosy', 'Rough', 'Round', 'Royal', 'Rude', 'Rural', 'Rusty',
  'Sad', 'Safe', 'Salty', 'Same', 'Sandy', 'Sane', 'Sassy', 'Scary', 'Shady', 'Shaky',
  'Sharp', 'Sheer', 'Shiny', 'Short', 'Shut', 'Shy', 'Sick', 'Silky', 'Silly', 'Sleek',
  'Slim', 'Slow', 'Small', 'Smart', 'Smoky', 'Snowy', 'Soapy', 'Soft', 'Soggy', 'Solar',
  'Solid', 'Some', 'Sore', 'Sorry', 'Sour', 'South', 'Spare', 'Spicy', 'Spiky', 'Split',
  'Stale', 'Stark', 'Steep', 'Stern', 'Stiff', 'Still', 'Stony', 'Sunny', 'Super',
  'Sure', 'Sweet', 'Swift', 'Tall', 'Tame', 'Tangy', 'Tasty','Tiny', 'Tense', 'Thick',
  'Thin', 'Third', 'Tidy', 'Tight', 'Tipsy', 'Tired', 'Top', 'Torn', 'Total',
  'Tough', 'Toxic', 'Trim', 'True', 'Ugly', 'Ultra', 'Under', 'Unfit', 'Upper', 'Urban',
  'Used', 'Usual', 'Vague', 'Vain', 'Valid', 'Vast', 'Very', 'Viral', 'Vital',
  'Vivid', 'Vocal', 'Warm', 'Wavy', 'Waxy', 'Weak', 'Weary', 'Weird', 'West', 'Wet',
];

export const NOUNS: string[] = [
  'Ant', 'Ape', 'Bat', 'Bear', 'Bee', 'Bird', 'Bull', 'Cat', 'Chick', 'Clam',
  'Cow', 'Crab', 'Crow', 'Cub', 'Deer', 'Dog', 'Dove', 'Duck', 'Eagle', 'Elk',
  'Fish', 'Fly', 'Fox', 'Frog', 'Goat', 'Goose', 'Hare', 'Hawk', 'Hen', 'Horse',
  'Lamb', 'Lion', 'Mole', 'Moose', 'Moth', 'Mouse', 'Mule', 'Owl', 'Pig', 'Pony',
  'Pup', 'Ram', 'Rat', 'Seal', 'Shark', 'Sheep', 'Slug', 'Snail', 'Snake', 'Swan',
  'Tiger', 'Toad', 'Tuna', 'Whale', 'Wolf', 'Worm', 'Zebra', 'Apple', 'Bean', 'Berry',
  'Corn', 'Date', 'Fig', 'Grape', 'Kiwi', 'Lemon', 'Lime', 'Mango', 'Melon', 'Olive',
  'Onion', 'Peach', 'Pea', 'Pear', 'Plum', 'Bacon', 'Bagel', 'Bread', 'Bun', 'Candy',
  'Cake', 'Chip', 'Cream', 'Curry', 'Egg', 'Flour', 'Ham', 'Honey', 'Jam', 'Juice',
  'Meat', 'Milk', 'Pasta', 'Pie', 'Pizza', 'Rice', 'Salad', 'Salt', 'Sauce', 'Soup',
  'Steak', 'Sugar', 'Tea', 'Toast', 'Water', 'Wine', 'Beach', 'Bush', 'Cave', 'Clay',
  'Cliff', 'Cloud', 'Coast', 'Daisy', 'Dawn', 'Dew', 'Dirt', 'Dust', 'Earth',
  'Field', 'Fire', 'Flame', 'Flood', 'Fog', 'Frost', 'Grass', 'Hay',
  'Hill', 'Ice', 'Isle', 'Ivy', 'Lake', 'Lava', 'Lawn', 'Leaf', 'Lily', 'Marsh',
  'Moon', 'Moss', 'Mud', 'Oak', 'Ocean', 'Palm', 'Path', 'Peak', 'Pine', 'Plant',
  'Pond', 'Rain', 'Reed', 'Reef', 'River', 'Rock', 'Root', 'Rose', 'Sand', 'Sea',
  'Seed', 'Sky', 'Snow', 'Soil', 'Star', 'Steam', 'Stem', 'Stone', 'Storm', 'Sun',
  'Swamp', 'Tide', 'Trail', 'Tree', 'Tulip', 'Vale', 'Vine', 'Wave', 'Weed', 'Wind',
  'Wood', 'Arm', 'Belly', 'Bone', 'Brain', 'Cheek', 'Chest', 'Chin', 'Ear',
  'Elbow', 'Eye', 'Face', 'Foot', 'Hair', 'Hand', 'Head', 'Heart', 'Heel', 'Hip',
  'Jaw', 'Knee', 'Leg', 'Lip', 'Lung', 'Mouth', 'Nail', 'Neck', 'Nose', 'Rib',
  'Shin', 'Skin', 'Skull', 'Spine', 'Thumb', 'Toe', 'Tooth', 'Vein', 'Wrist', 'Bag',
  'Ball', 'Bath', 'Bed', 'Bell', 'Bench', 'Bike', 'Board', 'Book', 'Boot', 'Bowl',
  'Box', 'Brick', 'Broom', 'Brush', 'Bulb', 'Bus', 'Cab', 'Cage', 'Can', 'Cap',
  'Car', 'Card', 'Chain', 'Chair', 'Clock', 'Cloth', 'Coat', 'Coin', 'Comb', 'Couch',
  'Cup', 'Desk', 'Dial', 'Dish', 'Door', 'Dress', 'Drum', 'Fan', 'Fence', 'Flag',
  'Floor', 'Fork', 'Frame', 'Gate', 'Gift', 'Glass', 'Globe', 'Glove', 'Glue', 'Gown',
  'Gun', 'Hat', 'Hook', 'Horn', 'Ink', 'Iron', 'Jar', 'Key', 'Knife', 'Lamp',
  'Lid', 'Lock', 'Map', 'Mask', 'Match', 'Mat', 'Medal', 'Mop', 'Mug', 'Net',
  'Nut', 'Oven', 'Pack', 'Pad', 'Pail', 'Pan', 'Pen', 'Phone', 'Pill', 'Pin',
  'Pipe', 'Plate', 'Plug', 'Pole', 'Pool', 'Pot', 'Pump', 'Purse', 'Rack', 'Ring',
  'Robe', 'Rod', 'Roof', 'Rope', 'Rug', 'Sack', 'Sail', 'Saw', 'Scarf', 'Shelf',
  'Shirt', 'Shoe', 'Sign', 'Silk', 'Sink', 'Skirt', 'Soap', 'Sock', 'Sofa', 'Spoon',
  'Stamp', 'Stick', 'Stool', 'Stove', 'Suit', 'Tape', 'Tent', 'Tile', 'Tire', 'Tool',
  'Towel', 'Toy', 'Tray', 'Truck', 'Tube', 'Van', 'Vase', 'Wall', 'Watch', 'Wheel',
  'Wire', 'Wool', 'Bank', 'Barn', 'Camp', 'City', 'Club', 'Court', 'Dock', 'Fort',
  'Gym', 'Hall', 'Home', 'Hotel', 'House', 'Hut', 'Inn', 'Lodge', 'Mall',
  'Mill', 'Mine', 'Motel', 'Nest', 'Park', 'Port', 'Pub', 'Ranch', 'Room', 'Shop',
  'Spa', 'Stage', 'Store', 'Tower', 'Town', 'Vault', 'Ward', 'Well', 'Yard', 'Zoo',
  'Actor', 'Baby', 'Boss', 'Boy', 'Bride', 'Chef', 'Child', 'Coach', 'Cook', 'Cop',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSuffix(): number {
  return Math.floor(Math.random() * 1000); // 0–999
}

export function generateNickname(): string {
  return `${randomItem(ADJECTIVES)}${randomItem(NOUNS)}${randomSuffix()}`;
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

  // Fallback: fix adj+noun, walk the suffix space then beyond
  const adj = randomItem(ADJECTIVES);
  const noun = randomItem(NOUNS);
  for (let i = 0; i < 10000; i++) {
    const candidate = `${adj}${noun}${i}`;
    const { rows } = await pg.query('SELECT 1 FROM users WHERE nickname = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }

  return `${adj}${noun}${Date.now()}`;
}

export function totalCombinations(): number {
  return ADJECTIVES.length * NOUNS.length * 1000;
}

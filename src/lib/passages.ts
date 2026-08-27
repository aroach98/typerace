// Passage pool. Every sentence here is either original or public domain.
// A race passage is assembled from several sentences so that even a very fast
// typist (200+ WPM ≈ 100 words in 30 s) cannot run out of text.

const SENTENCES: string[] = [
  'The quick brown fox jumps over the lazy dog while the farmer counts his sheep in the fading light.',
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.',
  'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.',
  'All happy families are alike; each unhappy family is unhappy in its own way.',
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
  'In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat.',
  'Two roads diverged in a yellow wood, and sorry I could not travel both and be one traveler, long I stood and looked down one as far as I could.',
  'Whenever you find yourself on the side of the majority, it is time to pause and reflect.',
  'The only thing we have to fear is fear itself, nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance.',
  'Ask not what your country can do for you; ask what you can do for your country.',
  'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights.',
  'Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal.',
  'It was a bright cold day in April, and the clocks were striking thirteen.',
  'The keyboard clicked like rain on a tin roof as the deadline crept closer and the coffee ran cold beside the monitor.',
  'She packed the car before sunrise, tossed the map onto the passenger seat, and pointed the hood toward whatever was west of here.',
  'Nobody warned the lighthouse keeper that the fog would hum, but by the third night he had learned to whistle along with it.',
  'The recipe called for patience, two eggs, and a pinch of salt, which is a fair summary of most things worth doing.',
  'Every great race begins with someone deciding that today is the day they finally stop watching from the sidelines.',
  'The train was late, the platform was cold, and yet the stranger reading a paperback seemed to be having the finest morning of anyone in the city.',
  'A river does not hurry, and still it arrives at the sea; the trick, apparently, is to keep moving in roughly the right direction.',
  'The mechanic wiped her hands on a rag, listened to the engine cough twice, and announced that it simply needed to be driven harder.',
  'Somewhere between the third cup of tea and the fourth chapter, the mystery stopped being about the missing necklace and started being about the butler.',
  'The garden did not care who owned the house; it grew toward the light and left the paperwork to the humans.',
  'On clear nights the observatory opens its dome like an eye, and the whole hillside seems to hold its breath.',
  'The old typewriter still worked, though the letter e had faded to a ghost and every page came out looking slightly haunted.',
  'He learned to juggle from a library book, which explains both his enthusiasm and the number of broken lamps.',
  'The best view of the storm was from the porch, wrapped in a blanket, with the dog pretending not to be afraid.',
  'A map is only a rumor about the world; the road is where you find out whether the rumor was true.',
  'The bakery opened at six, the line formed at five, and by seven the cinnamon rolls were a fond and buttery memory.',
  'Practice does not make perfect; practice makes permanent, so it is worth checking now and then that you are practicing the right thing.',
  'The satellite drifted over the coastline in silence, photographing fishing boats that would never know they had been seen.',
  'When the power went out, the neighborhood discovered it still remembered how to talk, play cards, and burn things in a controlled manner.',
  'The cat regarded the new sofa with the cool professional interest of a critic who has already decided on the review.',
  'The chess club met on Thursdays in a room that smelled of chalk, ambition, and slightly too many oranges.',
  'It takes a certain courage to send the email, press the button, or type the sentence and then not immediately read it back.',
  'The marathon runner did not think about the finish line; she thought about the next lamppost, and then the one after that.',
  'Fresh snow turns every footpath into a rough draft, and by noon the whole town has been edited.',
  'The submarine crew celebrated the holiday with canned peaches, a harmonica, and a rousing argument about the rules of cribbage.',
  'A well-made sandwich is architecture you can eat, and the tomato is the load-bearing wall.',
  'The apprentice ruined three pots before lunch and one masterpiece after it, which the potter said was about the usual ratio.',
];

const AMBIGUOUS = /[^A-Za-z0-9 .,;:'"!?()-]/g;

/** Build a passage of at least `minChars` characters from random sentences. */
export function buildPassage(minChars = 650, rng: () => number = Math.random): string {
  const pool = [...SENTENCES];
  const parts: string[] = [];
  let len = 0;
  while (len < minChars && pool.length) {
    const i = Math.floor(rng() * pool.length);
    const [s] = pool.splice(i, 1);
    const clean = s.replace(AMBIGUOUS, '').replace(/\s+/g, ' ').trim();
    parts.push(clean);
    len += clean.length + 1;
  }
  return parts.join(' ');
}

/** Deterministic PRNG so every client can rebuild the same passage from a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function passageFromSeed(seed: number): string {
  return buildPassage(650, mulberry32(seed));
}

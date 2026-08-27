// Who am I? Kept in localStorage so a refresh keeps your name and car.

export const CARS = ['🏎️', '🚗', '🚙', '🚕', '🚓', '🚌', '🛻', '🚜', '🏍️', '🚀', '🛸', '🦄'];
export const COLORS = ['#c8ff3d', '#ff4d8d', '#4dd2ff', '#ffb84d', '#b84dff', '#4dffb8', '#ff704d', '#ffe74d'];

export interface Player {
  id: string;
  name: string;
  car: string;
  color: string;
}

const KEY = 'typerace:me';

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ADJ = ['Swift', 'Turbo', 'Nitro', 'Rapid', 'Blazing', 'Zippy', 'Sonic', 'Flash', 'Rocket', 'Hyper'];
const NOUN = ['Otter', 'Falcon', 'Cheetah', 'Comet', 'Badger', 'Panther', 'Fox', 'Hare', 'Mongoose', 'Wombat'];

export function randomName(): string {
  return `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
}

export function loadMe(): Player {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Player>;
      if (p.id && p.name && p.car && p.color) return p as Player;
    }
  } catch {
    /* ignore */
  }
  const me: Player = {
    id: randomId(),
    name: randomName(),
    car: CARS[Math.floor(Math.random() * CARS.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  saveMe(me);
  return me;
}

export function saveMe(me: Player): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    /* ignore */
  }
}

// Join codes: 6 chars from an alphabet with no ambiguous glyphs (no 0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
export function isValidCode(s: string): boolean {
  return /^[A-Z0-9]{6}$/.test(s);
}

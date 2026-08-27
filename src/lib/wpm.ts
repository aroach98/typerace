// Speed and accuracy math. Same convention as TypeRacer: one "word" is five
// characters (spaces included), so WPM = (correct chars / 5) / minutes.

export const RACE_SECONDS = 30;
export const COUNTDOWN_MS = 3000;

export function wpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(correctChars / 5 / minutes);
}

export function accuracy(totalKeystrokes: number, errors: number): number {
  if (totalKeystrokes === 0) return 100;
  return Math.max(0, Math.round(((totalKeystrokes - errors) / totalKeystrokes) * 1000) / 10);
}

/** How many leading characters of `typed` match `target`. */
export function correctPrefix(typed: string, target: string): number {
  let i = 0;
  while (i < typed.length && i < target.length && typed[i] === target[i]) i++;
  return i;
}

/** Split a passage into words, each carrying its trailing space (except the last). */
export function splitWords(passage: string): string[] {
  const words = passage.split(' ');
  return words.map((w, i) => (i < words.length - 1 ? w + ' ' : w));
}

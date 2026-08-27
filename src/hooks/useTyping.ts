// The typing engine. TypeRacer-style: you type one word at a time into an
// input; when the word (plus its trailing space) is correct it commits and the
// box clears. A wrong character turns the box red and you must backspace to
// fix it — you cannot advance past an error.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accuracy, correctPrefix, splitWords, wpm, RACE_SECONDS } from '../lib/wpm';

export interface TypingStats {
  /** Characters of the passage committed correctly (incl. current partial word). */
  chars: number;
  wpm: number;
  acc: number;
  errors: number;
  keystrokes: number;
  finished: boolean;
  elapsedMs: number;
}

export interface Typing {
  words: string[];
  wordIndex: number;
  /** Text currently in the input for the active word. */
  typed: string;
  /** How much of `typed` is correct. */
  okLen: number;
  committedChars: number;
  stats: TypingStats;
  running: boolean;
  timeLeft: number;
  onInput: (value: string) => void;
  reset: () => void;
  /** Last keystroke was an error → drives the shake animation. */
  errorTick: number;
}

interface Opts {
  passage: string;
  /** performance.now() at which typing is allowed; null = not started. */
  startAt: number | null;
  durationMs?: number;
  onDone?: (final: TypingStats) => void;
}

export function useTyping({ passage, startAt, durationMs = RACE_SECONDS * 1000, onDone }: Opts): Typing {
  const words = useMemo(() => splitWords(passage), [passage]);
  const [wordIndex, setWordIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [keystrokes, setKeystrokes] = useState(0);
  const [errors, setErrors] = useState(0);
  const [errorTick, setErrorTick] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const committedChars = useMemo(() => {
    let n = 0;
    for (let i = 0; i < wordIndex; i++) n += words[i].length;
    return n;
  }, [words, wordIndex]);

  const target = words[wordIndex] ?? '';
  const okLen = correctPrefix(typed, target);
  const finished = wordIndex >= words.length;

  const reset = useCallback(() => {
    setWordIndex(0);
    setTyped('');
    setKeystrokes(0);
    setErrors(0);
    setFinishedAt(null);
    doneRef.current = false;
  }, []);

  // Fresh passage → fresh state.
  useEffect(() => {
    reset();
  }, [passage, reset]);

  // Clock. Ticks ~30 fps while a race is live for the timer and live WPM.
  const started = startAt !== null && now >= startAt;
  const running = started && !finished && finishedAt === null && now - startAt < durationMs;
  useEffect(() => {
    if (startAt === null) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startAt]);

  const elapsedMs = !started ? 0 : Math.min(durationMs, (finishedAt ?? now) - startAt);
  const timeLeft = !started ? RACE_SECONDS : Math.max(0, Math.ceil((durationMs - (now - startAt)) / 1000));

  const chars = committedChars + okLen;
  const stats: TypingStats = {
    chars,
    wpm: wpm(chars, Math.max(elapsedMs, 1)),
    acc: accuracy(keystrokes, errors),
    errors,
    keystrokes,
    finished,
    elapsedMs,
  };

  // Fire onDone exactly once when the timer expires or the passage is finished.
  const timeUp = startAt !== null && now - startAt >= durationMs;
  useEffect(() => {
    if (startAt === null || doneRef.current) return;
    if (timeUp || finished) {
      doneRef.current = true;
      onDoneRef.current?.({ ...stats, elapsedMs: finished ? elapsedMs : durationMs });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, finished, startAt]);

  const onInput = useCallback(
    (value: string) => {
      if (!running) return;
      // Count keystrokes (added chars) and errors (a newly added char that is wrong).
      if (value.length > typed.length) {
        const added = value.length - typed.length;
        setKeystrokes((k) => k + added);
        const okBefore = correctPrefix(typed, target);
        const okAfter = correctPrefix(value, target);
        // If we were already wrong, or the new char is wrong, that's an error.
        if (okAfter < value.length && !(okBefore < typed.length)) {
          setErrors((e) => e + 1);
          setErrorTick((t) => t + 1);
        } else if (okBefore < typed.length) {
          setErrors((e) => e + added);
        }
      }
      if (value === target) {
        // Word complete (target includes its trailing space, except the last word).
        const nextIndex = wordIndex + 1;
        setWordIndex(nextIndex);
        setTyped('');
        if (nextIndex >= words.length) setFinishedAt(performance.now());
        return;
      }
      setTyped(value);
    },
    [running, typed, target, wordIndex, words.length],
  );

  return {
    words,
    wordIndex,
    typed,
    okLen,
    committedChars,
    stats,
    running,
    timeLeft,
    onInput,
    reset,
    errorTick,
  };
}

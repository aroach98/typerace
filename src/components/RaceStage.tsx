import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import { useTyping, type TypingStats } from '../hooks/useTyping';
import type { Player } from '../lib/identity';
import type { Progress } from '../lib/room';
import { Countdown } from './Countdown';
import { Passage } from './Passage';
import { Speedometer } from './Speedometer';
import { Track } from './Track';

interface Props {
  passage: string;
  /** performance.now() at which typing opens; null = not started yet. */
  goAt: number | null;
  me: Player;
  players: Player[];
  progress: Record<string, Progress>;
  raceId: number;
  onProgress: (p: Progress) => void;
  onDone: (final: TypingStats) => void;
}

const THROTTLE_MS = 150;

export function RaceStage({ passage, goAt, me, players, progress, raceId, onProgress, onDone }: Props) {
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const handleDone = useCallback(
    (final: TypingStats) => {
      onProgressRef.current({
        id: me.id,
        raceId,
        chars: final.chars,
        wpm: final.wpm,
        acc: final.acc,
        finished: final.finished,
        done: true,
        elapsedMs: final.elapsedMs,
      });
      onDoneRef.current(final);
    },
    [me.id, raceId],
  );

  const t = useTyping({ passage, startAt: goAt, onDone: handleDone });
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on the box while racing.
  useEffect(() => {
    if (t.running) inputRef.current?.focus();
  }, [t.running]);
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  // Throttled live progress to the room.
  const lastSent = useRef(0);
  const pending = useRef<number | null>(null);
  const { chars, wpm, acc, finished } = t.stats;
  useEffect(() => {
    if (!t.running && chars === 0) return;
    const send = () => {
      lastSent.current = performance.now();
      onProgressRef.current({ id: me.id, raceId, chars, wpm, acc, finished, done: false, elapsedMs: t.stats.elapsedMs });
    };
    const wait = THROTTLE_MS - (performance.now() - lastSent.current);
    if (wait <= 0) send();
    else {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(send, wait);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars, wpm]);

  const bad = t.okLen < t.typed.length;

  return (
    <div className="stage panel">
      {goAt !== null && <Countdown goAt={goAt} />}
      <div className="hud">
        <div className="stat">
          <span className="v">{t.stats.acc}%</span>
          <span className="k">accuracy</span>
        </div>
        <div className={`timer ${t.timeLeft <= 5 && t.running ? 'low' : ''}`}>
          0:{String(t.timeLeft).padStart(2, '0')}
        </div>
        <div className="stat">
          <Speedometer wpm={t.stats.wpm} />
        </div>
      </div>

      <Track players={players} progress={progress} raceId={raceId} meId={me.id} />

      <Passage words={t.words} wordIndex={t.wordIndex} typed={t.typed} okLen={t.okLen} dim={goAt === null} />

      <motion.input
        ref={inputRef}
        key={t.errorTick}
        initial={t.errorTick ? { x: -6 } : false}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 900, damping: 12 }}
        className={`typebox ${bad ? 'bad' : ''}`}
        value={t.typed}
        onChange={(e) => t.onInput(e.target.value)}
        disabled={!t.running}
        placeholder={t.running ? '' : goAt === null ? 'Waiting for the host to start…' : 'Type when the light turns green'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the passage"
      />
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Type each word and press <span className="kbd">space</span>. Mistakes turn red — backspace to fix them.
      </p>
    </div>
  );
}

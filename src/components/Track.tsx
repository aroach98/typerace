import { motion } from 'framer-motion';
import type { Player } from '../lib/identity';
import type { Progress } from '../lib/room';

/** Characters from the start line to the chequered flag: 250 chars ≈ 100 WPM over 30 s. */
export const TRACK_CHARS = 250;

interface Props {
  players: Player[];
  progress: Record<string, Progress>;
  raceId: number;
  meId: string;
}

export function Track({ players, progress, raceId, meId }: Props) {
  return (
    <div className="track">
      {players.map((p) => {
        const pr = progress[p.id];
        const chars = pr && pr.raceId === raceId ? pr.chars : 0;
        const pct = Math.min(1, chars / TRACK_CHARS);
        const crossed = chars >= TRACK_CHARS;
        return (
          <div className="lane" key={p.id}>
            <div className="finish" />
            {crossed && (
              <motion.span
                className="flag"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: [1.4, 1], rotate: [15, 0] }}
                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
              >
                🏁
              </motion.span>
            )}
            <motion.div
              className="racer"
              initial={false}
              animate={{ left: `calc(${(pct * 92 + 4).toFixed(2)}%)` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.6 }}
            >
              <motion.span
                className={`emoji ${p.car === '🚀' || p.car === '🛸' ? 'fwd' : ''}`}
                animate={pr && !pr.done && chars > 0 ? { y: [0, -1.5, 0, 1.5, 0] } : { y: 0 }}
                transition={{ repeat: Infinity, duration: 0.35 }}
              >
                {p.car}
              </motion.span>
              <span className="meta">
                <b style={{ color: p.id === meId ? '#4dd2ff' : p.color }}>{p.name}</b>
                <span>{pr && pr.raceId === raceId ? `${pr.wpm} wpm` : '—'}</span>
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

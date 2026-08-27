import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import type { Player } from '../lib/identity';
import type { Progress } from '../lib/room';
import { TRACK_CHARS } from './Track';

interface Props {
  players: Player[];
  progress: Record<string, Progress>;
  raceId: number;
  meId: string;
  isHost: boolean;
  onAgain: () => void;
  onLeave: () => void;
  solo?: boolean;
}

interface Row {
  player: Player;
  p: Progress;
}

export function Results({ players, progress, raceId, meId, isHost, onAgain, onLeave, solo }: Props) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const player of players) {
      const p = progress[player.id];
      if (p && p.raceId === raceId) out.push({ player, p });
    }
    out.sort((a, b) => b.p.wpm - a.p.wpm || b.p.chars - a.p.chars || b.p.acc - a.p.acc);
    return out;
  }, [players, progress, raceId]);

  const allDone = rows.length > 0 && rows.every((r) => r.p.done);
  const myRank = rows.findIndex((r) => r.player.id === meId);
  const iWon = allDone && myRank === 0;

  useEffect(() => {
    if (!allDone) return;
    const winner = rows[0]?.player;
    const colors = [winner?.color ?? '#c8ff3d', '#ffffff', '#4dd2ff'];
    const burst = (x: number, angle: number) =>
      confetti({ particleCount: 90, spread: 70, angle, origin: { x, y: 0.7 }, colors, disableForReducedMotion: true });
    burst(0.1, 60);
    burst(0.9, 120);
    if (iWon) {
      const t = window.setTimeout(
        () => confetti({ particleCount: 200, spread: 160, startVelocity: 45, origin: { y: 0.4 }, colors, disableForReducedMotion: true }),
        400,
      );
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const top3 = rows.slice(0, 3);
  const order = [1, 0, 2].map((i) => top3[i]).filter(Boolean) as Row[]; // 2nd, 1st, 3rd

  return (
    <div className="panel">
      <h2 className="center" style={{ fontSize: 28 }}>
        {solo
          ? 'Time!'
          : allDone
            ? iWon
              ? '🏆 You won!'
              : myRank >= 0
                ? `You finished ${ordinal(myRank + 1)}`
                : 'Race over'
            : 'Waiting for the others to finish…'}
      </h2>

      {!solo && (
        <div className="podium">
          {order.map((r) => {
            const place = rows.indexOf(r) + 1;
            return (
              <motion.div
                className={`spot p${place}`}
                key={r.player.id}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 160, damping: 16, delay: place === 1 ? 0.25 : place === 2 ? 0.1 : 0 }}
              >
                <div className="who">
                  <div className="car">{r.player.car}</div>
                  <b style={{ color: r.player.color }}>{r.player.name}</b>
                  {r.p.wpm} wpm
                </div>
                <div className="block">{place}</div>
              </motion.div>
            );
          })}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Racer</th>
            <th>WPM</th>
            <th>Accuracy</th>
            <th>Chars</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr
              key={r.player.id}
              className={r.player.id === meId ? 'me' : ''}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <td className="num">{i + 1}</td>
              <td>
                <span style={{ fontSize: 20, marginRight: 8 }}>{r.player.car}</span>
                <b style={{ color: r.player.color }}>{r.player.name}</b>
                {r.player.id === meId && <span className="badge" style={{ marginLeft: 8 }}>you</span>}
              </td>
              <td className="num">{r.p.wpm}</td>
              <td className="num">{r.p.acc}%</td>
              <td className="num">{r.p.chars}</td>
              <td>
                {r.p.done ? (
                  r.p.finished ? <span className="badge">whole passage 🏁</span> : r.p.chars >= TRACK_CHARS ? <span className="badge">crossed the line 🏁</span> : null
                ) : (
                  <span className="badge live">still typing…</span>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      <div className="row mt" style={{ justifyContent: 'center' }}>
        {solo || isHost ? (
          <button className="btn big" onClick={onAgain}>
            {solo ? 'Go again' : 'Race again'} 🔁
          </button>
        ) : (
          <span className="muted">Waiting for the host to start the next race…</span>
        )}
        <button className="btn secondary" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

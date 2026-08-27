import { motion } from 'framer-motion';
import { useState } from 'react';
import { isValidCode, newRoomCode, normalizeCode, type Player } from '../lib/identity';
import { hasRealtime } from '../lib/room';
import { PlayerEditor } from './PlayerEditor';

interface Props {
  me: Player;
  setMe: (p: Player) => void;
  onCreate: (code: string) => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
}

export function Home({ me, setMe, onCreate, onJoin, onSolo }: Props) {
  const [code, setCode] = useState('');
  const online = hasRealtime();
  const valid = isValidCode(code);

  return (
    <div className="container">
      <motion.div className="hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1>
          Thirty seconds. <span className="glow">How fast can you type?</span>
        </h1>
        <p>Make a lobby, send your friends a link or a join code, and race.</p>
      </motion.div>

      <div className="grid two">
        <motion.div className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2>🏁 Race your friends</h2>
          <p className="sub">Create a lobby and invite people, or join one with a code.</p>
          <button className="btn big block" disabled={!online} onClick={() => onCreate(newRoomCode())}>
            Create a lobby
          </button>
          <div className="row" style={{ margin: '14px 0 6px' }}>
            <span className="muted small">— or join with a code —</span>
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) onJoin(code);
            }}
          >
            <input
              className="input code"
              style={{ flex: 1, minWidth: 160 }}
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              disabled={!online}
              aria-label="Join code"
            />
            <button className="btn pink" type="submit" disabled={!valid || !online}>
              Join
            </button>
          </form>
          {!online && (
            <p className="muted small mt">
              Multiplayer is off in this build — set <span className="kbd">VITE_SUPABASE_URL</span> and{' '}
              <span className="kbd">VITE_SUPABASE_ANON_KEY</span>. Solo practice still works.
            </p>
          )}
        </motion.div>

        <motion.div className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2>🧑‍🚀 Your racer</h2>
          <p className="sub">Shown to everyone in your lobby.</p>
          <PlayerEditor me={me} onChange={setMe} />
        </motion.div>
      </div>

      <motion.div className="panel mt" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>⌨️ Practice solo</h2>
            <p className="sub" style={{ margin: 0 }}>
              Same 30-second sprint, no lobby. Warm up before you challenge anyone.
            </p>
          </div>
          <button className="btn secondary" onClick={onSolo}>
            Start a solo run
          </button>
        </div>
      </motion.div>

      <div className="footer">
        WPM = correct characters ÷ 5 ÷ minutes, the same convention TypeRacer uses. Open source on{' '}
        <a href="https://github.com/aroach98/typerace" target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </div>
    </div>
  );
}

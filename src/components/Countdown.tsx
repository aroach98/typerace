import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { COUNTDOWN_MS } from '../lib/wpm';

/** 3-2-1-GO overlay driven by a performance.now() start time. */
export function Countdown({ goAt }: { goAt: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const remaining = goAt - now;
  if (remaining < -700) return null;
  const step = Math.ceil(remaining / (COUNTDOWN_MS / 3)); // 3,2,1,0
  const label = step <= 0 ? 'GO!' : String(step);
  const lit = 3 - Math.max(0, step);

  return (
    <div className="countdown">
      <div className="center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={label}
            className={`num ${label === 'GO!' ? 'go' : ''}`}
            initial={{ scale: 2.2, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {label}
          </motion.div>
        </AnimatePresence>
        <div className="lights">
          <i className={lit >= 1 ? 'red' : ''} />
          <i className={lit >= 2 ? 'yellow' : ''} />
          <i className={lit >= 3 ? 'green' : ''} />
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>
          Fingers on the keys…
        </p>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';

const MAX = 160;

/** A little analog gauge. Needle sweeps -120°..+120° for 0..160 WPM. */
export function Speedometer({ wpm }: { wpm: number }) {
  const clamped = Math.max(0, Math.min(MAX, wpm));
  const angle = -120 + (clamped / MAX) * 240;
  const ticks = Array.from({ length: 9 }, (_, i) => -120 + i * 30);
  return (
    <svg className="gauge" viewBox="0 0 120 90" aria-label={`${wpm} words per minute`}>
      <defs>
        <linearGradient id="arc" x1="0" x2="1">
          <stop offset="0" stopColor="#4dd2ff" />
          <stop offset="0.6" stopColor="#c8ff3d" />
          <stop offset="1" stopColor="#ff4d8d" />
        </linearGradient>
      </defs>
      <path d="M 12 70 A 48 48 0 1 1 108 70" fill="none" stroke="#2a2f3e" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M 12 70 A 48 48 0 1 1 108 70"
        fill="none"
        stroke="url(#arc)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="201"
        strokeDashoffset={201 - (clamped / MAX) * 201}
        style={{ transition: 'stroke-dashoffset 0.25s ease-out' }}
      />
      {ticks.map((t) => (
        <line
          key={t}
          x1="60"
          y1="18"
          x2="60"
          y2="24"
          stroke="#5b6178"
          strokeWidth="2"
          transform={`rotate(${t} 60 66)`}
        />
      ))}
      <motion.line
        x1="60"
        y1="66"
        x2="60"
        y2="26"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ originX: '60px', originY: '66px' }}
        animate={{ rotate: angle }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      />
      <circle cx="60" cy="66" r="5" fill="#c8ff3d" />
      <text x="60" y="86" textAnchor="middle" fontSize="13" fontWeight="700">
        {wpm} wpm
      </text>
    </svg>
  );
}

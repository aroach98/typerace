import { CARS, COLORS, type Player } from '../lib/identity';

export function PlayerEditor({ me, onChange }: { me: Player; onChange: (p: Player) => void }) {
  return (
    <div>
      <label className="label" htmlFor="name">
        Your name
      </label>
      <input
        id="name"
        className="input"
        value={me.name}
        maxLength={24}
        onChange={(e) => onChange({ ...me, name: e.target.value })}
        onBlur={() => {
          if (!me.name.trim()) onChange({ ...me, name: 'Anonymous' });
        }}
      />
      <span className="label" style={{ marginTop: 14 }}>
        Your ride
      </span>
      <div className="carpick">
        {CARS.map((c) => (
          <button key={c} className={c === me.car ? 'on' : ''} onClick={() => onChange({ ...me, car: c })} aria-label={c}>
            {c}
          </button>
        ))}
      </div>
      <span className="label" style={{ marginTop: 14 }}>
        Your colour
      </span>
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className={c === me.color ? 'on' : ''}
            style={{ background: c }}
            onClick={() => onChange({ ...me, color: c })}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

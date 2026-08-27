import { useCallback, useMemo, useState } from 'react';
import type { Player } from '../lib/identity';
import { buildPassage } from '../lib/passages';
import type { Progress } from '../lib/room';
import { COUNTDOWN_MS } from '../lib/wpm';
import { RaceStage } from './RaceStage';
import { Results } from './Results';

export function Solo({ me, onLeave }: { me: Player; onLeave: () => void }) {
  const [raceId, setRaceId] = useState(1);
  const passage = useMemo(() => buildPassage(), [raceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [goAt, setGoAt] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [done, setDone] = useState(false);

  const start = useCallback(() => {
    setDone(false);
    setProgress({});
    setGoAt(performance.now() + COUNTDOWN_MS);
  }, []);

  const again = () => {
    setRaceId((r) => r + 1);
    setGoAt(null);
    setDone(false);
    setProgress({});
  };

  const players = useMemo(() => [me], [me]);

  return (
    <div className="container">
      {done ? (
        <Results players={players} progress={progress} raceId={raceId} meId={me.id} isHost onAgain={again} onLeave={onLeave} solo />
      ) : (
        <>
          {goAt === null && (
            <div className="row" style={{ justifyContent: 'center', margin: '18px 0' }}>
              <button className="btn big" onClick={start}>
                Start the clock ⏱️
              </button>
              <button className="btn secondary" onClick={onLeave}>
                Back
              </button>
            </div>
          )}
          <RaceStage
            passage={passage}
            goAt={goAt}
            me={me}
            players={players}
            progress={progress}
            raceId={raceId}
            onProgress={(p) => setProgress((prev) => ({ ...prev, [p.id]: p }))}
            onDone={() => setDone(true)}
          />
        </>
      )}
    </div>
  );
}

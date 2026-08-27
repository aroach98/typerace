import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '../lib/identity';
import { passageFromSeed } from '../lib/passages';
import { useRoom, type RoomState } from '../lib/room';
import { COUNTDOWN_MS } from '../lib/wpm';
import { Invite } from './Invite';
import { PlayerEditor } from './PlayerEditor';
import { RaceStage } from './RaceStage';
import { Results } from './Results';
import { Track } from './Track';

interface Props {
  code: string;
  creating: boolean;
  me: Player;
  setMe: (p: Player) => void;
  onLeave: () => void;
}

export function RoomView({ code, creating, me, setMe, onLeave }: Props) {
  const room = useRoom(code, me, creating);
  const { state, players, progress, isHost, setState, sendProgress, status } = room;
  const passage = useMemo(() => (state ? passageFromSeed(state.seed) : ''), [state?.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local race clock. Each client starts its own 3-second countdown the moment
  // it hears the host's "countdown" state, so nobody depends on anyone's clock.
  const [goAt, setGoAt] = useState<number | null>(null);
  const [myDone, setMyDone] = useState(false);
  const startedRace = useRef(0);

  // Everyone's clock ends within ~a second of mine. If someone's final message
  // never lands, stop waiting on them after a grace period.
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (!myDone) {
      setGraceOver(false);
      return;
    }
    const t = window.setTimeout(() => setGraceOver(true), 4000);
    return () => window.clearTimeout(t);
  }, [myDone]);

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'lobby') {
      startedRace.current = 0;
      setGoAt(null);
      setMyDone(false);
      return;
    }
    if (state.phase === 'countdown' && startedRace.current !== state.raceId) {
      startedRace.current = state.raceId;
      setMyDone(false);
      setGoAt(performance.now() + COUNTDOWN_MS);
    }
  }, [state?.phase, state?.raceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host: flip to 'racing' when the countdown ends, 'results' when my clock ends.
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'countdown' || goAt === null) return;
    const t = window.setTimeout(() => setState({ ...state, phase: 'racing' }), Math.max(0, goAt - performance.now()));
    return () => window.clearTimeout(t);
  }, [isHost, state, goAt, setState]);

  const hostStart = () => {
    if (!state) return;
    setState({ ...state, phase: 'countdown', countdownAt: Date.now() });
  };
  const hostAgain = () => {
    if (!state) return;
    const next: RoomState = {
      phase: 'lobby',
      raceId: state.raceId + 1,
      seed: Math.floor(Math.random() * 2 ** 31),
      hostId: state.hostId,
      countdownAt: 0,
    };
    setState(next);
  };
  const onDone = useCallback(() => {
    setMyDone(true);
    if (isHost && state && state.phase !== 'results') setState({ ...state, phase: 'results' });
  }, [isHost, state, setState]);

  const host = players[0];
  const racers: Player[] = players;

  if (status === 'not-found') {
    return (
      <div className="container">
        <div className="panel center">
          <h2>Lobby {code} isn't open</h2>
          <p className="muted">Nobody's here — the host may have left, or the code was mistyped.</p>
          <button className="btn" onClick={onLeave}>
            Back home
          </button>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="container">
        <div className="panel center">
          <h2>Couldn't connect</h2>
          <p className="muted">The realtime service isn't reachable right now. Try again in a moment.</p>
          <button className="btn" onClick={onLeave}>
            Back home
          </button>
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="container">
        <div className="panel center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} style={{ fontSize: 40, display: 'inline-block' }}>
            🏎️
          </motion.div>
          <p className="muted">Joining lobby {code}…</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'lobby') {
    return (
      <div className="container">
        <div className="grid two">
          <div className="panel">
            <h2>{isHost ? 'Your lobby' : `${host?.name ?? 'Someone'}'s lobby`}</h2>
            <p className="sub">Share the code or link. The race starts when the host hits go.</p>
            <Invite code={code} hostName={host?.name ?? me.name} />
            <div className="row mt" style={{ justifyContent: 'center' }}>
              {isHost ? (
                <button className="btn big pink" onClick={hostStart}>
                  Start race 🚦
                </button>
              ) : (
                <span className="muted">Waiting for {host?.name ?? 'the host'} to start…</span>
              )}
              <button className="btn secondary" onClick={onLeave}>
                Leave
              </button>
            </div>
          </div>
          <div className="panel">
            <h2>
              Racers <span className="badge">{players.length}</span>
            </h2>
            <div className="players">
              {players.map((p, i) => (
                <motion.div className="player" key={p.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
                  <span className="car">{p.car}</span>
                  <span className="name" style={{ color: p.color }}>
                    {p.name}
                  </span>
                  {i === 0 && <span className="tag">host</span>}
                  {p.id === me.id && <span className="tag you">you</span>}
                </motion.div>
              ))}
            </div>
            <details className="mt">
              <summary className="muted small" style={{ cursor: 'pointer' }}>
                Change my name or car
              </summary>
              <div style={{ marginTop: 10 }}>
                <PlayerEditor me={me} onChange={setMe} />
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  // In a race (or just finished one).
  const inThisRace = startedRace.current === state.raceId && goAt !== null;
  if (inThisRace && !myDone) {
    return (
      <div className="container">
        <RaceStage
          passage={passage}
          goAt={goAt}
          me={me}
          players={racers}
          progress={progress}
          raceId={state.raceId}
          onProgress={sendProgress}
          onDone={onDone}
        />
      </div>
    );
  }
  if (inThisRace || state.phase === 'results') {
    return (
      <div className="container">
        <div className="panel" style={{ marginBottom: 16 }}>
          <Track players={racers} progress={progress} raceId={state.raceId} meId={me.id} />
        </div>
        <Results
          players={racers}
          progress={progress}
          raceId={state.raceId}
          meId={me.id}
          isHost={isHost}
          onAgain={hostAgain}
          onLeave={onLeave}
          forceDone={graceOver}
        />
      </div>
    );
  }
  // Spectating: joined mid-race.
  return (
    <div className="container">
      <div className="panel">
        <h2>Race in progress 🍿</h2>
        <p className="sub">You'll be in the next one — watch the cars for now.</p>
        <Track players={racers} progress={progress} raceId={state.raceId} meId={me.id} />
        <button className="btn secondary" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

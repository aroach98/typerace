// Multiplayer room built purely on Supabase Realtime (Broadcast + Presence).
// No database tables, no server: the room exists exactly as long as someone is
// in it. The host is the oldest player present; if they leave, the next-oldest
// takes over automatically.
//
// Wire protocol (all on channel `room:<CODE>`):
//   presence  – each player tracks { ...Player, joinedAt }
//   'state'   – host → all: RoomState (re-sent on every join, every change,
//               and every 2 s as insurance against a missed message)
//   'hello'   – joiner → host: "please send me the state"
//   'progress'– each → all: Progress (throttled). Carries the sender's Player
//               so a lane can render even if their presence never arrived.
//               The final one has `done: true` and is re-sent a few times.
//
// Design rule learned the hard way: never let the *result* depend on presence.
// Presence flickers when a phone suspends a tab or a connection blips; the set
// of racers is therefore presence ∪ everyone who sent progress for this race,
// and progress rows are only ever dropped when a new race starts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Player } from './identity';

export type Phase = 'lobby' | 'countdown' | 'racing' | 'results';

export interface RoomState {
  phase: Phase;
  raceId: number;
  seed: number;
  hostId: string;
  /** Host wall-clock (ms) when the countdown began. Informational only. */
  countdownAt: number;
}

export interface Progress {
  id: string;
  raceId: number;
  chars: number;
  wpm: number;
  acc: number;
  /** Crossed the whole passage. */
  finished: boolean;
  /** Timer expired (or finished) — this is the final score. */
  done: boolean;
  elapsedMs: number;
  /** Sender's display info, so a lane can render without presence. */
  player?: Player;
}

export type PresentPlayer = Player & { joinedAt: number };
export type RoomStatus = 'connecting' | 'open' | 'not-found' | 'error';
export type LinkStatus = 'connecting' | 'live' | 'reconnecting';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
  });
  return client;
}

export function hasRealtime(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

const NOT_FOUND_GRACE_MS = 6000;
const STATE_REBROADCAST_MS = 2000;
const FINAL_RESEND_MS = [800, 2500, 6000];

// Always-on lightweight diagnostics. Open the console and filter "[typerace]"
// when a race goes weird — this is what to paste into a bug report.
const dlog = (...a: unknown[]) => console.debug('[typerace]', new Date().toISOString().slice(11, 23), ...a);

/** A final (`done`) row for a race is never overwritten by a live tick that arrives late. */
function mergeProgress(prev: Record<string, Progress>, p: Progress): Record<string, Progress> {
  const cur = prev[p.id];
  if (cur && cur.raceId === p.raceId && cur.done && !p.done) return prev;
  if (cur && cur.raceId === p.raceId && cur.done && p.done && cur.chars >= p.chars) return prev;
  return { ...prev, [p.id]: p };
}

export interface Room {
  status: RoomStatus;
  link: LinkStatus;
  /** Players currently present (sorted oldest first — index 0 is the host). */
  players: PresentPlayer[];
  /** Present players ∪ anyone who has sent progress for the current race. */
  racers: Player[];
  state: RoomState | null;
  progress: Record<string, Progress>;
  isHost: boolean;
  /** Host-only: publish a new state (also applied locally). */
  setState: (next: RoomState) => void;
  sendProgress: (p: Progress) => void;
}

export function useRoom(code: string | null, me: Player, creating: boolean): Room {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [link, setLink] = useState<LinkStatus>('connecting');
  const [players, setPlayers] = useState<PresentPlayer[]>([]);
  const [state, setStateLocal] = useState<RoomState | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const chanRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const joinedAtRef = useRef<number>(Date.now());
  const meRef = useRef(me);
  meRef.current = me;
  const myFinalRef = useRef<Progress | null>(null);
  const resendTimers = useRef<number[]>([]);

  const applyState = useCallback((s: RoomState) => {
    stateRef.current = s;
    setStateLocal(s);
    setStatus('open');
  }, []);

  const rawSend = useCallback((event: string, payload: unknown) => {
    const chan = chanRef.current;
    if (!chan) return;
    void chan.send({ type: 'broadcast', event, payload }).then((r) => {
      if (r !== 'ok') dlog('send', event, '→', r);
    });
  }, []);

  useEffect(() => {
    if (!code) return;
    const sb = supabase();
    if (!sb) {
      setStatus('error');
      return;
    }
    joinedAtRef.current = Date.now();
    myFinalRef.current = null;
    const chan = sb.channel(`room:${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: false, ack: false } },
    });
    chanRef.current = chan;

    if (creating) {
      const initial: RoomState = {
        phase: 'lobby',
        raceId: 1,
        seed: Math.floor(Math.random() * 2 ** 31),
        hostId: me.id,
        countdownAt: 0,
      };
      stateRef.current = initial;
      setStateLocal(initial);
    }

    const readPresence = (): PresentPlayer[] => {
      const raw = chan.presenceState<PresentPlayer>();
      const list: PresentPlayer[] = [];
      for (const key of Object.keys(raw)) {
        const entries = raw[key];
        if (!entries?.length) continue;
        const p = entries[entries.length - 1];
        list.push({ id: p.id, name: p.name, car: p.car, color: p.color, joinedAt: p.joinedAt });
      }
      list.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
      return list;
    };

    const amHost = (list: PresentPlayer[]) => list.length > 0 && list[0].id === meRef.current.id;

    const broadcastState = () => {
      const s = stateRef.current;
      if (s) void chan.send({ type: 'broadcast', event: 'state', payload: s });
    };
    const resendFinal = () => {
      const f = myFinalRef.current;
      if (f && f.raceId === stateRef.current?.raceId) void chan.send({ type: 'broadcast', event: 'progress', payload: f });
    };

    chan
      .on('presence', { event: 'sync' }, () => {
        const list = readPresence();
        dlog('presence', list.map((p) => `${p.name}${p.id === meRef.current.id ? '(me)' : ''}`).join(', '));
        setPlayers(list);
        if (amHost(list)) {
          const cur = stateRef.current;
          if (cur && cur.hostId !== meRef.current.id) applyState({ ...cur, hostId: meRef.current.id });
          broadcastState();
        }
      })
      .on('presence', { event: 'join' }, () => {
        // Someone (re)joined: make sure they have my final score if I have one.
        resendFinal();
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const s = payload as RoomState;
        const cur = stateRef.current;
        if (cur && cur.phase === s.phase && cur.raceId === s.raceId && cur.seed === s.seed && cur.hostId === s.hostId) return;
        dlog('state', s.phase, 'race', s.raceId);
        applyState(s);
      })
      .on('broadcast', { event: 'hello' }, () => {
        if (amHost(readPresence())) broadcastState();
        resendFinal();
      })
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        const p = payload as Progress;
        if (p.done) dlog('final from', p.player?.name ?? p.id, p.wpm, 'wpm');
        setProgress((prev) => mergeProgress(prev, p));
      })
      .subscribe(async (st, err) => {
        dlog('channel', st, err?.message ?? '');
        if (st === 'SUBSCRIBED') {
          setLink('live');
          await chan.track({ ...meRef.current, joinedAt: joinedAtRef.current });
          // Ask for state on every (re)subscribe — a rejoin after a dropped
          // socket must catch up exactly like a fresh join.
          void chan.send({ type: 'broadcast', event: 'hello', payload: { id: meRef.current.id } });
          if (creating || stateRef.current) setStatus('open');
          resendFinal();
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
          setLink('reconnecting');
        }
      });

    // Host insurance: re-broadcast state every couple of seconds.
    const rebroadcast = window.setInterval(() => {
      if (amHost(readPresence())) broadcastState();
    }, STATE_REBROADCAST_MS);

    // If nobody answers our hello, the room doesn't exist.
    const notFound = creating
      ? null
      : window.setTimeout(() => {
          if (!stateRef.current) {
            const list = readPresence();
            if (list.length === 1 && list[0].id === meRef.current.id) {
              dlog('alone in the room after grace period → becoming host');
              applyState({
                phase: 'lobby',
                raceId: 1,
                seed: Math.floor(Math.random() * 2 ** 31),
                hostId: meRef.current.id,
                countdownAt: 0,
              });
            } else {
              setStatus('not-found');
            }
          }
        }, NOT_FOUND_GRACE_MS);

    return () => {
      if (notFound) window.clearTimeout(notFound);
      window.clearInterval(rebroadcast);
      for (const t of resendTimers.current) window.clearTimeout(t);
      resendTimers.current = [];
      chanRef.current = null;
      void chan.untrack();
      void sb.removeChannel(chan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, creating]);

  // Re-track when name/car changes so others see it.
  useEffect(() => {
    const chan = chanRef.current;
    if (!chan || link !== 'live') return;
    void chan.track({ ...me, joinedAt: joinedAtRef.current });
  }, [me, link]);

  // New race → forget old progress.
  const raceId = state?.raceId ?? 0;
  useEffect(() => {
    setProgress((prev) => {
      const next: Record<string, Progress> = {};
      for (const k of Object.keys(prev)) if (prev[k].raceId === raceId) next[k] = prev[k];
      return next;
    });
    if (myFinalRef.current && myFinalRef.current.raceId !== raceId) myFinalRef.current = null;
  }, [raceId]);

  const setState = useCallback(
    (next: RoomState) => {
      applyState(next);
      rawSend('state', next);
    },
    [applyState, rawSend],
  );

  const sendProgress = useCallback(
    (p: Progress) => {
      const full: Progress = { ...p, player: meRef.current };
      setProgress((prev) => mergeProgress(prev, full));
      rawSend('progress', full);
      if (full.done) {
        myFinalRef.current = full;
        for (const t of resendTimers.current) window.clearTimeout(t);
        resendTimers.current = FINAL_RESEND_MS.map((ms) =>
          window.setTimeout(() => {
            if (myFinalRef.current === full) rawSend('progress', full);
          }, ms),
        );
      }
    },
    [rawSend],
  );

  const isHost = useMemo(() => players.length > 0 && players[0].id === me.id, [players, me.id]);

  const racers = useMemo<Player[]>(() => {
    const out: Player[] = players.map(({ id, name, car, color }) => ({ id, name, car, color }));
    const ids = new Set(out.map((p) => p.id));
    for (const p of Object.values(progress)) {
      if (p.raceId !== raceId || ids.has(p.id)) continue;
      ids.add(p.id);
      out.push(p.player ?? { id: p.id, name: 'Racer', car: '🚗', color: '#8b91a7' });
    }
    if (!ids.has(me.id)) out.unshift(me);
    return out;
  }, [players, progress, raceId, me]);

  return { status, link, players, racers, state, progress, isHost, setState, sendProgress };
}

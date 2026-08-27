// Multiplayer room built purely on Supabase Realtime (Broadcast + Presence).
// No database tables, no server: the room exists exactly as long as someone is
// in it. The host is the oldest player present; if they leave, the next-oldest
// takes over automatically.
//
// Wire protocol (all on channel `room:<CODE>`):
//   presence  – each player tracks { ...Player, joinedAt }
//   'state'   – host → all: RoomState (re-sent on every join and every change)
//   'hello'   – joiner → host: "please send me the state"
//   'progress'– each → all: Progress (throttled), incl. the final `done: true`

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
}

export type PresentPlayer = Player & { joinedAt: number };
export type RoomStatus = 'connecting' | 'open' | 'not-found' | 'error';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export function hasRealtime(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

const NOT_FOUND_GRACE_MS = 4000;

export interface Room {
  status: RoomStatus;
  players: PresentPlayer[];
  state: RoomState | null;
  progress: Record<string, Progress>;
  isHost: boolean;
  /** Host-only: publish a new state (also applied locally). */
  setState: (next: RoomState) => void;
  sendProgress: (p: Progress) => void;
}

export function useRoom(code: string | null, me: Player, creating: boolean): Room {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [players, setPlayers] = useState<PresentPlayer[]>([]);
  const [state, setStateLocal] = useState<RoomState | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const chanRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const joinedAtRef = useRef<number>(Date.now());
  const meRef = useRef(me);
  meRef.current = me;

  const applyState = useCallback((s: RoomState) => {
    stateRef.current = s;
    setStateLocal(s);
    setStatus('open');
  }, []);

  useEffect(() => {
    if (!code) return;
    const sb = supabase();
    if (!sb) {
      setStatus('error');
      return;
    }
    joinedAtRef.current = Date.now();
    const chan = sb.channel(`room:${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: false, ack: false } },
    });
    chanRef.current = chan;

    // Seed the host's initial state before we even connect, so the first
    // presence sync can answer any early "hello".
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
        // One entry per key (we key presence by player id); take the newest.
        const p = entries[entries.length - 1];
        list.push({ id: p.id, name: p.name, car: p.car, color: p.color, joinedAt: p.joinedAt });
      }
      list.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
      return list;
    };

    const amHost = (list: PresentPlayer[]) => list.length > 0 && list[0].id === meRef.current.id;

    const broadcastState = () => {
      const s = stateRef.current;
      if (!s) return;
      void chan.send({ type: 'broadcast', event: 'state', payload: s });
    };

    chan
      .on('presence', { event: 'sync' }, () => {
        const list = readPresence();
        setPlayers(list);
        // Host migration: if I'm the oldest present, I'm the host.
        if (amHost(list)) {
          const cur = stateRef.current;
          if (cur && cur.hostId !== meRef.current.id) {
            applyState({ ...cur, hostId: meRef.current.id });
          }
          broadcastState();
        }
        // Drop progress rows for players who left.
        setProgress((prev) => {
          const ids = new Set(list.map((p) => p.id));
          const next: Record<string, Progress> = {};
          for (const k of Object.keys(prev)) if (ids.has(k)) next[k] = prev[k];
          return next;
        });
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        applyState(payload as RoomState);
      })
      .on('broadcast', { event: 'hello' }, () => {
        if (amHost(readPresence())) broadcastState();
      })
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        const p = payload as Progress;
        setProgress((prev) => ({ ...prev, [p.id]: p }));
      })
      .subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          await chan.track({ ...meRef.current, joinedAt: joinedAtRef.current });
          if (!creating) {
            void chan.send({ type: 'broadcast', event: 'hello', payload: { id: meRef.current.id } });
          } else {
            setStatus('open');
          }
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          setStatus('error');
        }
      });

    // If nobody answers our hello, the room doesn't exist.
    const notFound = creating
      ? null
      : window.setTimeout(() => {
          if (!stateRef.current) {
            // Maybe everyone left but I'm now alone — then I become host of a fresh room.
            const list = readPresence();
            if (list.length === 1 && list[0].id === meRef.current.id) {
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
      chanRef.current = null;
      void chan.untrack();
      void sb.removeChannel(chan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, creating]);

  // Re-track when name/car changes so others see it.
  useEffect(() => {
    const chan = chanRef.current;
    if (!chan || status !== 'open') return;
    void chan.track({ ...me, joinedAt: joinedAtRef.current });
  }, [me, status]);

  const setState = useCallback(
    (next: RoomState) => {
      applyState(next);
      const chan = chanRef.current;
      if (chan) void chan.send({ type: 'broadcast', event: 'state', payload: next });
    },
    [applyState],
  );

  const sendProgress = useCallback((p: Progress) => {
    setProgress((prev) => ({ ...prev, [p.id]: p }));
    const chan = chanRef.current;
    if (chan) void chan.send({ type: 'broadcast', event: 'progress', payload: p });
  }, []);

  const isHost = useMemo(() => players.length > 0 && players[0].id === me.id, [players, me.id]);

  return { status, players, state, progress, isHost, setState, sendProgress };
}

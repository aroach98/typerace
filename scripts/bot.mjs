#!/usr/bin/env node
// Headless racer for debugging the room protocol over a real network.
//
//   node scripts/bot.mjs --code ABC123 --name Bot1 --wpm 80 [--host] [--start-after 8] [--players 2]
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env (or the env).
// Logs every presence sync, every broadcast, channel status changes, socket
// errors and heartbeat results with timestamps, so you can see exactly what a
// client does (or doesn't) receive during a race. With --host it starts the
// countdown once --players racers are present (or after --start-after seconds).

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
    return acc;
  }, []),
);
try {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* no .env */
}

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing');
const code = String(args.code || '').toUpperCase();
if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('--code ABC123 required');
const name = String(args.name || `Bot${Math.floor(Math.random() * 100)}`);
const targetWpm = Number(args.wpm || 60);
const isHost = Boolean(args.host);
const startAfter = Number(args['start-after'] || 8) * 1000;
const wantPlayers = Number(args.players || 2);
const RACE_MS = 30000;
const COUNTDOWN_MS = 3000;
const THROTTLE_MS = Number(args.throttle || 150);

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(2).padStart(6)}s ${name}]`, ...a);

const id = Math.random().toString(16).slice(2, 18);
const player = { id, name, car: '🤖', color: '#4dd2ff' };
const me = { ...player, joinedAt: Date.now() };

const sb = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
});
sb.realtime.onHeartbeat?.((status, latency) => log('heartbeat', status, latency ?? ''));
sb.realtime.onError?.((e) => log('SOCKET ERROR', e?.message ?? e));
sb.realtime.onClose?.((e) => log('SOCKET CLOSE', e?.code ?? '', e?.reason ?? ''));

const chan = sb.channel(`room:${code}`, { config: { presence: { key: id }, broadcast: { self: false, ack: false } } });

let state = isHost ? { phase: 'lobby', raceId: 1, seed: 42, hostId: id, countdownAt: 0 } : null;
let raceStarted = false;
let sent = 0;
let sendFailures = 0;
const seen = {};

const players = () => {
  const raw = chan.presenceState();
  return Object.keys(raw)
    .map((k) => raw[k][raw[k].length - 1])
    .sort((a, b) => a.joinedAt - b.joinedAt);
};

async function send(event, payload) {
  const r = await chan.send({ type: 'broadcast', event, payload });
  if (r !== 'ok') {
    sendFailures++;
    log(`SEND ${event} -> ${r}`);
  }
  return r;
}

function startRace() {
  if (raceStarted) return;
  raceStarted = true;
  log('countdown received → my clock starts');
  const goAt = Date.now() + COUNTDOWN_MS;
  // --flap N: drop the socket N seconds into the race and reconnect 3 s later,
  // the way a phone does when it suspends the tab. Exercises rejoin + resend.
  if (args.flap) {
    setTimeout(() => {
      log('FLAP: disconnecting socket');
      sb.realtime.disconnect();
      setTimeout(() => {
        log('FLAP: reconnecting');
        sb.realtime.connect();
        chan.subscribe();
      }, 3000);
    }, COUNTDOWN_MS + Number(args.flap) * 1000);
  }
  const charsPerMs = (targetWpm * 5) / 60000;
  let last = 0;
  const iv = setInterval(async () => {
    const el = Date.now() - goAt;
    if (el < 0) return;
    if (el >= RACE_MS) {
      clearInterval(iv);
      const chars = Math.round(charsPerMs * RACE_MS);
      await send('progress', { id, raceId: state.raceId, chars, wpm: targetWpm, acc: 100, finished: false, done: true, elapsedMs: RACE_MS, player });
      log(`DONE sent (chars=${chars}); ${sent} progress msgs sent, ${sendFailures} send failures`);
      setTimeout(report, 5000);
      return;
    }
    if (el - last < THROTTLE_MS) return;
    last = el;
    const chars = Math.round(charsPerMs * el);
    sent++;
    await send('progress', { id, raceId: state.raceId, chars, wpm: targetWpm, acc: 100, finished: false, done: false, elapsedMs: el, player });
  }, 25);
}

function report() {
  log('--- final view of others ---');
  for (const [pid, p] of Object.entries(seen)) log(`  ${pid.slice(0, 6)} msgs=${p.count} lastChars=${p.chars} done=${p.done}`);
  log(`presence now: ${players().map((p) => p.name).join(', ')}`);
  process.exit(0);
}

chan
  .on('presence', { event: 'sync' }, () => {
    const list = players();
    log(`presence sync: [${list.map((p) => p.name + (p.id === id ? '(me)' : '')).join(', ')}]`);
    if (isHost && list[0]?.id === id && state) void send('state', state);
  })
  .on('presence', { event: 'join' }, ({ newPresences }) => log('presence join:', newPresences.map((p) => p.name).join(',')))
  .on('presence', { event: 'leave' }, ({ leftPresences }) => log('presence LEAVE:', leftPresences.map((p) => p.name).join(',')))
  .on('broadcast', { event: 'state' }, ({ payload }) => {
    log('state:', payload.phase, 'race', payload.raceId);
    state = payload;
    if (payload.phase === 'countdown') startRace();
  })
  .on('broadcast', { event: 'hello' }, () => {
    log('hello received');
    if (isHost && state) void send('state', state);
  })
  .on('broadcast', { event: 'progress' }, ({ payload }) => {
    const s = (seen[payload.id] ??= { count: 0, chars: 0, done: false, name: payload.id });
    s.count++;
    s.chars = payload.chars;
    if (payload.done) {
      s.done = true;
      log(`progress DONE from ${payload.id.slice(0, 6)} chars=${payload.chars} (after ${s.count} msgs)`);
    } else if (s.count % 20 === 1) log(`progress from ${payload.id.slice(0, 6)} chars=${payload.chars} (#${s.count})`);
  })
  .on('system', {}, (m) => log('system:', JSON.stringify(m).slice(0, 200)))
  .subscribe(async (status, err) => {
    log('channel status:', status, err?.message ?? '');
    if (status === 'SUBSCRIBED') {
      await chan.track(me);
      if (!isHost) await send('hello', { id });
    }
  });

if (isHost) {
  const tryStart = () => {
    if (state.phase !== 'lobby') return;
    const n = players().length;
    if (n >= wantPlayers) {
      log(`host: ${n} players present → starting countdown`);
      state = { ...state, phase: 'countdown', countdownAt: Date.now() };
      void send('state', state);
      startRace();
      setTimeout(() => {
        state = { ...state, phase: 'racing' };
        void send('state', state);
      }, COUNTDOWN_MS);
    } else setTimeout(tryStart, 500);
  };
  setTimeout(tryStart, startAfter);
}

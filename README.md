# typerace

A lightweight, open-source, multiplayer typing race. Make a lobby, send your
friends a link (or a 6-letter join code), and everyone types the same passage for
**30 seconds** — highest words-per-minute wins. Live at
**[type.andrewroach.xyz](https://type.andrewroach.xyz)**.

- **No accounts, no database, no server.** Multiplayer runs entirely over
  [Supabase Realtime](https://supabase.com/docs/guides/realtime) Broadcast +
  Presence channels from the browser. A lobby exists exactly as long as someone
  is in it.
- **Host migration.** The oldest player present is the host. If they leave, the
  next-oldest takes over automatically.
- **Invite three ways.** Copy the link, copy the code, or hit *Email invite*
  (opens your mail client with the link + code pre-filled). Mobile gets the
  native share sheet too.
- **TypeRacer-style typing.** One word at a time; a wrong character turns the box
  red and you must backspace to fix it before you can move on. Green text is
  committed, red highlight is your current mistake, blinking caret is where you
  are.
- **Scoring.** `WPM = (correct characters ÷ 5) ÷ minutes` — the same convention
  TypeRacer uses. Accuracy = (keystrokes − errors) ÷ keystrokes.
- **The track.** Cars advance per character typed; the chequered flag sits at
  250 characters (≈ 100 WPM over 30 s). Cross it and you get a flag — and keep
  typing, because the score is what you manage in the full 30 seconds.
- **Animations.** 3-2-1 traffic-light countdown, spring-physics cars, a swinging
  speedometer, an error shake, a rising podium, and confetti for the winner.
- **Solo practice** works with no backend at all.

## Run it locally

```bash
npm install
cp .env.example .env      # optional — needed only for multiplayer
npm run dev
```

Without the two `VITE_SUPABASE_*` env vars the site still runs; only solo mode
is enabled and the lobby buttons explain why.

## Self-host / fork

1. Create a free [Supabase](https://supabase.com) project (or use one you have).
   Nothing needs to be created inside it — Realtime channels are on by default.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the *publishable* /
   anon key — it is meant to be public) in your host's env.
3. `npm run build` → deploy the `dist/` folder anywhere static. It's a single-page
   app, so route every path to `index.html` (see `vercel.json`).

That's it. Free-tier Realtime allows 200 concurrent connections and 2 million
messages a month, which is a lot of typing races.

## How the room protocol works

Everything for lobby `ABC123` happens on the Realtime channel `room:ABC123`.

| Message | Direction | Payload |
| --- | --- | --- |
| presence | each player | `{ id, name, car, color, joinedAt }` |
| `state` | host → all | `{ phase, raceId, seed, hostId, countdownAt }` — re-sent on every join and every change |
| `hello` | joiner → host | asks for the current `state` |
| `progress` | each → all | `{ id, raceId, chars, wpm, acc, finished, done, elapsedMs }`, throttled to ~7/s, with `done: true` on the final one |

The passage is generated deterministically from `seed` (`src/lib/passages.ts`),
so it never has to be sent over the wire. When the host flips `phase` to
`countdown`, each client starts **its own** 3-second countdown and 30-second clock
on receipt — nobody depends on anyone else's wall clock, so a few hundred ms of
network latency is the only skew.

A joiner that hears no `state` within 6 seconds concludes the lobby doesn't
exist (unless it finds itself alone in presence, in which case it becomes host of
a fresh room — that's how the creator survives a page reload).

### Surviving flaky connections

Phones suspend background tabs, cellular blips happen, and Supabase presence
flickers when they do. The rules that keep a race honest through all of that:

- **The result never depends on presence.** The set of racers is presence ∪
  everyone who has sent `progress` for the current race, and `progress` carries the
  sender's name/car so a lane can render even if their presence never arrived.
  Progress rows are only dropped when a new race starts.
- **Finals are redundant.** The `done: true` message is re-sent at +0.8 s, +2.5 s
  and +6 s, and again whenever anyone joins or says `hello`. A `done` row is never
  overwritten by a late live tick.
- **State is redundant.** The host re-broadcasts `state` every 2 s, on every
  presence sync, and in reply to every `hello`. A client that reconnects
  re-tracks presence and re-sends `hello`, so it catches up like a fresh join.
- **Two clients that both believe they're host converge**: presence order (oldest
  `joinedAt`) decides, and everyone applies whatever `state` arrives.
- While the socket is down, `supabase-js` falls back to REST delivery for
  broadcasts, so a short blip usually loses nothing at all; a
  **"Reconnecting…"** badge shows when the channel isn't live.

Every client logs presence syncs, state changes, channel status and received
finals to the console under `[typerace]` — paste that into a bug report.

### Debugging over a real network

`scripts/bot.mjs` is a headless racer that joins (or hosts) a lobby, types at a
given WPM, and logs every event with timestamps:

```bash
node scripts/bot.mjs --code ABC123 --name Bot --wpm 70            # join your lobby
node scripts/bot.mjs --code ABC123 --name Bot --wpm 70 --flap 8   # …and drop its socket 8 s in
node scripts/bot.mjs --code ABC123 --host --players 2             # host; starts when 2 are present
```

## Project layout

```
src/lib/passages.ts   sentence pool + seeded passage builder
src/lib/wpm.ts        WPM / accuracy math, race constants
src/lib/identity.ts   player identity (localStorage), join-code alphabet
src/lib/room.ts       useRoom() — the Supabase Realtime room hook
src/hooks/useTyping.ts the typing engine
src/components/       Home, RoomView (lobby / race / results), Solo, RaceStage,
                      Track, Passage, Countdown, Speedometer, Results, Invite
```

## Deploying this instance

`type.andrewroach.xyz` deploys through GitHub Actions (`.github/workflows/vercel.yml`)
rather than Vercel's Git integration; see the workflow comments for why.

## License

MIT — see [LICENSE](./LICENSE). The passage pool is original prose plus
public-domain excerpts.

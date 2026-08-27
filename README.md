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

A joiner that hears no `state` within 4 seconds concludes the lobby doesn't
exist (unless it finds itself alone in presence, in which case it becomes host of
a fresh room — that's how the creator survives a page reload).

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

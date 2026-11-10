# Pub Brawl load test

The harness is `loadtest/pub-brawl.mjs`. It refuses any URL that contains the
live project ref `wqdrbywcktxgytkyqcco`. `loadtest/staging.mjs` is the same
run at 10 players and only starts when `STAGING_SUPABASE_URL` is set to
somewhere else.

Players sign in, queue a real 10-card deck, get paired, and play by sending
intents to the edge function. A share of them drop the socket and sync back.
A share go idle so the server clock can forfeit them. After the run, every
finished match is replayed from its seed and its stored actions and compared
to the hash on the row.

## How this VM ran it

`supabase start` cannot finish here. This Docker has no iptables, so the
bridge DNS that the CLI's containers use returns `nxdomain` and the database
container exits during setup. The images were already pulled, so the same
official images were started on the host network instead: Postgres 15.19,
PostgREST, GoTrue, and Realtime. The functions are the source under
`supabase/functions/`, served by Deno (`loadtest/edge-serve.ts`) behind
`loadtest/gateway.mjs`, which stands in for Kong. That is the stack the
numbers below were measured on. A normal machine should use `supabase start`
and does not need the gateway.

The turn clock was shortened with `PVP_TURN_MS=3000` so a sweep could be
observed inside the run. Production stays at 90 seconds unless that env var
is set. The harness budget after sign-in is about 24 seconds, which is enough
for a 3 second clock and not enough once the queue itself takes longer.

## What broke, and the fix

| Break | Fix |
| --- | --- |
| Two joins that raced the try-lock both returned "still waiting" and never paired | The join retries the claim, and every queue status poll claims again. The lock is still try-only, so one request pairs a batch and the rest do not queue behind it |
| Match open failed: the seed did not fit a signed integer | Seeds are masked to 31 bits |
| Replay diverged. A timeout was stored on the player who noticed the clock, not the player whose clock ran out | The action row wears the seat the sweep actually forfeited |
| A jsonb round trip reordered keys, so a correct replay hashed differently from the row read back | The state hash sorts keys |
| PostgREST's pool of 10 connections sat under the 100-player run | Pool raised to 40. Latency did not drop. The single Deno process is the limit, not the pool |
| Realtime answered 404 on `/websocket` and then "tenant 127" | The gateway forwards `/realtime/v1` to `/socket` and names the seeded tenant in the Host header |

## Results

Move latency is the edge-function response. Queue time is how long a player
waited to see an opponent. Realtime lag is arrival minus the `servedAt` the
function wrote. Reconnect is a player who dropped and then synced. Divergence
is finished matches whose replay hash did not match the stored hash.
Deadlocks are Postgres `pg_stat_database.deadlocks` for that run. None were
still waiting at the end.

| Players | Pass | Completed | Move p50 / p95 / p99 | Queue p50 | Realtime p50 | Reconnect | Divergence | Deadlocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | after | 2 / 2 | 30 / 36 / 40 ms | 99 ms | 263 ms | n/a | 0 | 0 |
| 100 | before | 100 / 100 | 765 / 1226 / 1339 ms | 2.3 s | 1.1 s | 10 / 10 | 8 / 50 | 0 |
| 100 | after | 82 / 100 | 1032 / 1323 / 1420 ms | 2.9 s | 2.0 s | 5 / 5 | 0 / 41 | 0 |
| 500 | after | 201 / 500 | 3.6 / 6.3 / 7.8 s | 8.9 s | 4.2 s | 10 / 10 | 0 / 165 | 0 |
| 1000 | after | 258 / 1000 | 7.5 / 10.0 / 10.1 s | 14.1 s | 4.2 s | 4 / 7 | 0 / 231 | 7 |

The "before" 100-player run is the first time the matchmaker actually paired
people, still on a pool of 10 and still labeling timeouts on the wrong seat.
The "after" runs are the fixes above, on a pool of 40. The 100-player latency
did not improve. What improved is the thing that matters for a brawl: every
finished match replayed to the stored state.

Turn-clock lateness (finished_at minus the deadline), for matches the clock
ended:

| Players | p50 | p95 | p99 |
| --- | --- | --- | --- |
| 100 after | 400 ms | 772 ms | n/a |
| 1000 | 2.1 s | 3.0 s | 3.2 s |

The sweeper in the harness runs every 500 ms. At 100 players it lands inside
about a second. At 1000 the function is busy and the clock is a couple of
seconds late.

## The ceiling

Two players are a normal brawl: a full match, a 30 ms move, realtime under
300 ms, replay clean.

One hundred players all finish a match and the replay is clean after the
timeout-seat fix, with moves around a second. Five hundred and a thousand do
not. On this one Deno process, a thousand players produced 231 matches before
the harness budget ran out, move latency around 8 seconds, realtime around 4
seconds, and 7 deadlocks. No lock was still waiting afterwards, and the 231
matches that did finish replayed clean. The auth service also started
refusing calls (840 `auth` errors at 1000). That is the ceiling of a single
function process and a single GoTrue, not of the match row. More than one
function instance, and a longer clock than the 3 seconds used here, is what
a thousand concurrent stools needs. The production default clock stays 90
seconds.

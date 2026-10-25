# ShowDart games and results on Playground lane screens

Analysis: 25 October 2026. Based on the local source in `Playground 2` and `Playground/dart-club-site`. This is a proposed design, not an implemented integration or a measurement of the current production database.

Implementation update: the bridge has since been implemented and tested locally. See `docs/lane-screen-setup.md` and `docs/lane-screen-verification.md` for the delivered behavior, activation steps, and verification limits. The analysis below is retained as the design record.

## Recommendation

Add a small, authenticated ShowDart display bridge to the existing Playground lane-screen system. Send only each lane's current board and approved result. Reuse Playground's permanent screen pages, display renderer, ordered revisions, Realtime broadcasts, and recovery mechanism.

Keep tournament rules, score calculation, complete history, and authoritative results in ShowDart. Playground stores a small, replaceable display projection: the information needed to draw the screen now.

This is the simplest complete solution that supports live play, results, screen recovery, and controlled database load. It needs no new hosting service, message broker, Redis instance, or database synchronization system. It adds modest database work; it cannot honestly promise zero additional load or no overload without measuring production capacity.

## What already exists

| Area | Local evidence | Implication |
| --- | --- | --- |
| ShowDart scoring | `app/spil/page.js`, `lib/mickey/engine.js`, `lib/mickey/finalEngine.js` | Standard Mickey and individual finals already run locally and save progress in browser storage. There is no lane-display publisher yet. |
| Approved results | `app/api/lane-match/route.js` | Results update the owner's tournament state, check concurrent changes, and broadcast tournament state. This should remain the result authority. |
| Lane assignment | `lib/laneMatch.js` | Current published matches already have lane numbers, participants, and round labels. |
| Permanent screens | `src/app/screens/[screenSlug]/page.tsx` in Playground | Existing `/screens/lane-N` pages can remain the Pi entry points. |
| Transport and recovery | `src/lib/lane-display-protocol.ts`, `realtime-tournament-lane-display-app.tsx` | Lane-scoped messages, stream IDs, revisions, snapshots, reconnect recovery, and a randomized 120–180-second safety check already exist. |
| Mickey rendering | `LaneDisplayMickeyState`, `MickeyLaneDisplayView` | The screen supports two to four players and nine marks per player. Reuse this board. |
| Existing writer | `upsert_kamptavle_mickey_multiplayer_lane_stream` | It requires a Playground `auth.uid()` and an owned training-lane reservation. A ShowDart login or a server secret alone does not satisfy those checks. |
| Existing priority | `build_kamptavle_lane_display_v2_state` | Playground tournament content takes priority over training. The bridge must participate in this arbitration. |

The current Mickey display contract contains names and marks but no winner, final placements, result approval status, or expiry. Its existing completed-match view is designed around two-player X01 results. Neither directly represents ShowDart's multiplayer final results.

## Proposed flow

```text
ShowDart scoring tablet
  -> ShowDart authenticated API
  -> signed, lane-scoped request to Playground integration API
  -> one atomic database operation: validate lease/version, update projection
  -> existing Playground display-state producer
  -> existing lane Realtime channel
  -> existing /screens/lane-N page on the Pi
```

Use one small source table, provisionally `external_lane_display_states`, with at most one current row per physical lane in this installation. Suggested fields are source identity, lane number, session ID, source revision, compact payload, payload hash, lease expiry, and update time. Use a lane primary key and a unique session identity where appropriate. Enable RLS; allow writes only through the restricted integration path. Do not add history rows for each score change.

The source session ID should include a fresh competition-instance UUID and match identity. Existing numeric match IDs and fixed competition keys alone can repeat after a tournament reset.

Extend Playground's existing state builder to select this source when its lane is authorized, reserved, and available. Refresh only the changed lane. Keep the existing display producer as the sole allocator of display revisions and publisher to `solbakkens-display:lane:N`. A second publisher inventing its own revisions on that channel would create conflicting streams.

Use a dedicated integration endpoint rather than weakening the training writer's ownership checks. Server-side signing establishes which application is sending; separately verify that its organizer is authorized for the venue and lane. Apply a lane allowlist, short-lived scoped authorization, request size limits, and atomic session/version checks. Keep integration and database secrets on servers. Public display data must contain only information intended for the lane screen; a public read URL is not write authorization.

## User experience and results

1. The organizer enables ShowDart on selected lanes in Playground screen management.
2. The tablet selects its lane and claims it. An occupied lane returns a clear error. Claiming must use the same atomic arbitration as existing training reservations so two sources cannot both win.
3. Starting a match publishes the names and initial board. Changes and undo publish the latest board.
4. Finishing shows an unconfirmed outcome until the players approve it.
5. Approval first saves through ShowDart's existing result API. Only a successful save may produce a confirmed winner or final placements on the screen.
6. The confirmed result remains visible for a configurable period, initially 20 seconds, then the screen shows the next assigned match or returns to its configured idle content.

Extend the Mickey contract and renderer with session identity, stage, optional winner/placements, and expiry/hold timestamps. Preserve compatibility with current training Mickey payloads. ShowDart team labels can be displayed as board-side names; keep actual participant identities and throwing order stable when mapping final placements.

Add explicit expiry handling for the external Mickey and result states. The present client expiry helper handles completed states and training `live` states, not Mickey. Expiry must work even if the sending tablet disappears without releasing the lane.

## Database-load controls

| Control | Proposed behavior |
| --- | --- |
| Updates | Send only when visible board data changes; ignore target selection, menus, language controls, and identical payloads. |
| Burst control | Coalesce rapid input into the latest complete board; cap ordinary publishing at two updates per second per lane and retain a trailing update. |
| Ordering | Allow one request in flight per session and retain only the newest pending board. Reject stale source revisions; accept undo as a newer revision. |
| Payload | Target less than 4 KB for ordinary board messages; omit visits/history, tournament JSON, and unrelated statistics. |
| Storage | Replace the current source row. Do not copy ShowDart tournaments, users, or full results history into Playground. |
| Producer | Refresh only the affected lane. Skip identical visible states and avoid global statistics calculations. |
| Reservations | Renew only active sessions, roughly every 60 seconds with jitter and a lease around 130 seconds, consistent with current reservation timing. Let score writes renew when due instead of adding a redundant request. |
| Screens | Retain Realtime updates and current slow recovery. Add no fast polling or Pi maintenance heartbeat. |
| Failures | Use bounded exponential backoff with jitter; do not replay every obsolete score update. |

Send compact full Mickey boards initially. Two to four players with nine marks each are small. The existing producer may use snapshots for Mickey; adding a new patch protocol is unnecessary unless measurements justify it. Keep request timestamps outside the visible payload so a heartbeat does not force a board broadcast.

Load illustration, not a benchmark: eight lanes averaging one visible update every 15 seconds produce **1,920 ingestion operations per hour**, plus renewals and recovery. Eight screens with the existing 120–180-second recovery average approximately **192 recovery requests per hour**. Actual SQL work exceeds these API counts: projection writes can also update the stored display state and write a database Broadcast message. Instrument those operations separately.

For comparison, eight screens fetching every eight seconds make **3,600 fetches per hour even when nothing changes**. ShowDart's existing spectator pages currently use that interval; the scoring setup also refreshes lane matches every five seconds while the scorer is closed. These hit ShowDart's configured database, which has not been established here as the same production database as Playground. Replace those loops with events and slow recovery before using them widely; do not embed those pages as the permanent lane solution.

The earlier Playground report `docs/supabase-screen-load-analysis.md` attributes substantial historical traffic to frequent maintenance check-ins. Preserve its later optimizations and measure current deltas rather than treating old cumulative figures as today's load.

## Failure handling and ownership

- A lost display connection must not stop scoring or reverse a saved result. Keep scoring state locally and show screen-connection status on the tablet.
- On reconnect, send the newest complete board. Screens recover from the persisted display projection without needing the tablet to answer a request.
- Persist pending confirmed-result delivery alongside the authoritative ShowDart result, atomically. Retry delivery with a stable idempotency key; mark delivered after acknowledgment. The retry mechanism must survive a browser closing, for example a small source-side outbox worker or scheduled retry. This is low-frequency result traffic, not a per-score queue.
- Repeated delivery must not advance a tournament twice, increment display state unnecessarily, or reset the result hold timer. Later result corrections receive a newer revision.
- Existing Playground tournament reservations take precedence by default. Require an explicit admin source switch for a takeover; reject a ShowDart claim when the lane is reserved by another source.
- Release on a normal stop, and fall back on lease expiry after a crash. Compare session identity during release so an old tablet cannot clear a newer match.

## Implementation and validation

**ShowDart:** add a compact state mapper and coalescing publisher near the scoring page; add authenticated bridge routes and lane-session handling; publish confirmed results from the result-save path; add durable retry for final delivery. Replace five-second setup refresh with tournament-change signals and slow recovery.

**Playground:** add the integration endpoint and small source table/RPC; extend shared lane arbitration and the display builder; add Mickey result metadata/rendering and expiry support; add an admin enable/disable control. Keep the current Pi URLs and maintenance-agent cadence.

Roll out to one lane behind an enable flag, then test two- and four-player games, throwing order, undo, approval, correction, duplicate and out-of-order requests, simultaneous claims, lane moves, tablet loss, and Pi reconnect. Measure SQL calls/time, database CPU, gateway requests, Broadcast volume, and update latency against an equivalent baseline. Target ordinary screen updates within approximately one second on a healthy connection; verify rather than guarantee this from source inspection. Expand to all lanes only when the measured increase is acceptable. Disabling the source should immediately restore normal Playground selection.

## Alternatives considered

| Alternative | Assessment |
| --- | --- |
| Switch the Pi to a ShowDart spectator URL | Fast demonstration, but the current page is a tournament overview with eight-second polling and does not mirror the live Mickey board. |
| Copy ShowDart tournaments into Playground tables | Adds synchronization, conflicts, and unnecessary database/storage work. |
| Call the existing Mickey training writer directly | Useful for a same-auth live-board prototype, but ownership, result display, expiry, and tournament priority still need work. |
| Separate Realtime-only overlay with no database state | Can reduce score writes, but needs its own recovery, source arbitration, and reliable result handling. Consider only if measurements show the compact projection approach is too costly. |
| Separate broker/cache service | Useful at larger scale or under a strict zero-score-write requirement, but adds infrastructure and operational complexity for this installation. |

## Documentation checked

Supabase supports Broadcast from clients, REST, and the database. Database-origin Broadcast writes to `realtime.messages`, so it is not database-free. See [Broadcast](https://supabase.com/docs/guides/realtime/broadcast). Channel authorization and publishing permissions are separate concerns; see [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization). Check [Realtime Reports](https://supabase.com/docs/guides/realtime/reports) during the pilot.

No application code, database schema, Pi configuration, or production service was changed during this analysis.

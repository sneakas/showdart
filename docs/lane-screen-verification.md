# Lane-screen integration verification

Verified locally on 25 October 2026.

- **ShowDart:** all 59 engine and bridge tests passed; production build passed.
- **Playground:** all 143 tests passed across 24 files; type check, lint on changed code, and production build passed. The full test run used a 15-second timeout for the existing process-startup test.
- **PostgreSQL:** both new migrations were applied to a fresh isolated test schema. Assertions passed for disabled defaults, shared lane arbitration, rate limits, stale updates, heartbeats without broadcasts, result hold/expiry, duplicate deliveries, newer-session protection, native tournament priority, admin disable, role grants, optimistic concurrency, and atomic result/outbox rollback. Separate database connections also verified competing native and ShowDart claims in both orders.
- **Browser:** both real Next.js applications ran against the isolated database and a local Supabase HTTP test adapter. Checks passed for tablet login, authenticated bridging, live boards, undo, pending approval, saved tournament results, two-player winners, four-player throwing order and final rankings, and 720p/1080p television layouts.
- **Recovery:** a separate browser check passed for free-play scoring state, the enabled-screen preference, and lane identity across reload. A simulated screen outage left the approved free-play result queued; the authenticated retry endpoint delivered it after the tablet page closed. Repeated worker calls did not replay the result or extend its hold.

The database tests used the existing display producer with isolated native-state and Realtime fixtures. The browser test blocked external Realtime connections and verified screen rendering through snapshot recovery. These checks did not contact the production database, test delivery through the live Supabase Realtime service, or operate physical Raspberry Pis. The one-lane production pilot and capacity measurements remain activation checks.

Preview images are saved in `output/lane-screen/`, including `live.png`, `result.png`, `four-player-live.png`, and `four-player-result-720p.png`.

Follow `docs/lane-screen-setup.md` to apply the migrations, configure the two applications, install the retry schedule, and enable the first lane. No production database, deployment setting, or physical screen was changed during implementation.
# Published-pairing verification

The publication extension is covered by `tests/laneAnnouncements.test.mjs`, `tests/laneAnnouncements.integration.sql`, and Playground's `src/lib/showdart-bridge.test.ts`.

Verified against isolated PostgreSQL using the real display producer: draft privacy, duplicate suppression, monotonic delivery, clear tombstones, native/live/result priority, offline Pi snapshot recovery, disable/reenable, service-only writes, both-competition comparison checks, atomic result/announcement save and rollback, bounded replacement queue, backoff, and stale acknowledgment protection. The previous bridge SQL regression suite also passes with the new migration installed.

Browser verification ran the real ShowDart publication and result APIs, the signed Playground integration API, PostgreSQL, and the existing lane-screen component. It confirmed pairing → live score → approved result → next pairing, unpublication, queued delivery after the organizer browser closed, championship team names, and four-player finals. Screenshots were inspected at 1280×720 and 1920×1080. Production game data was not used for these tests.

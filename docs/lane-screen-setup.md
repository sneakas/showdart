# Lane-screen bridge: installation and operation

The integration is implemented in both local projects. It reuses Playground's existing `/screens/lane-N` pages. No Raspberry Pi software or kiosk URL change is required. Production databases, hosting settings, and physical screens have not been changed.

## Enable it

1. Apply the migrations below to the correct databases **before deploying the updated applications**. Both migrations are inactive until the bridge and individual lanes are enabled.
   - ShowDart (`Playground 2`): `supabase/migrations/20261025172535_showdart_display_outbox.sql`.
   - Playground (`Playground/dart-club-site`): `supabase/migrations/20261025172536_showdart_lane_display.sql`. This expects the existing current lane-display and multiplayer Mickey migrations to have been applied.
2. Configure the server settings below, using a single new random secret of at least 32 characters in both applications. Keep the secret out of browser/public settings.
3. Deploy both applications and configure the approved-result retry schedule.
4. In Playground's **screen management**, choose one test lane and press **Tillad ShowDart**. Other lanes remain disabled.
5. In ShowDart's **Spil** page, choose the same lane, enable **Vis spil og resultat på baneskærmen**, and start a match. The scoring page reports connection errors and provides a retry button. Scoring can continue when a screen is unavailable.
6. Verify the live board, undo, result approval, final placements, and reconnect on that lane before enabling the remaining lanes.

The applications continue using their own existing Supabase configuration. They need not share a database, Supabase account, or user sessions.

## Server settings

On **ShowDart**:

| Setting | Value |
| --- | --- |
| `LANE_SCREEN_PLAYGROUND_URL` | The deployed Playground HTTPS origin. The bridge adds `/api/integrations/showdart/lane-display`. |
| `LANE_SCREEN_BRIDGE_SECRET` | The shared random integration secret, at least 32 characters. |
| `LANE_SCREEN_ALLOWED_USER_IDS` | Comma-separated **ShowDart** user UUIDs authorized to use club screens. Empty means disabled. |
| `LANE_SCREEN_LANES` | Comma-separated physical lane numbers, for example `1,2,3,4,5,6,7,8`. |
| `CRON_SECRET` | A separate random secret for the result-retry endpoint. |

On **Playground**:

| Setting | Value |
| --- | --- |
| `SHOWDART_BRIDGE_SECRET` | Exactly the same integration secret as ShowDart's `LANE_SCREEN_BRIDGE_SECRET`. |
| `SHOWDART_ALLOWED_USER_IDS` | The same permitted **ShowDart** user UUIDs. These are not Playground user UUIDs. |

The UUID allowlists are deliberate authorization, independent of signing the application request. Each lane must also be enabled by a Playground administrator. Missing settings leave the integration disabled. Local development permits HTTP only for `localhost` and `127.0.0.1`.

## Approved-result retry schedule

For this installation's Vercel Hobby plan, use the source-side Supabase scheduler in `supabase/migrations/20261025184555_showdart_retry_scheduler.sql`. It creates a paused job named `showdart-lane-display-retry`; configure Vault entries `showdart_lane_display_retry_url` and `showdart_lane_display_retry_token`, then activate the job after deployment verification. The URL is the ShowDart origin plus `/api/lane-display/retry`, and the token must match ShowDart's production `CRON_SECRET`. The job checks only the small ShowDart queue and makes an HTTP request when delivery or retention cleanup is due. Playground's database does not host this scheduler.

`deploy/vercel-lane-screen.json` is a ready-to-use Vercel schedule for `GET /api/lane-display/retry` once per minute. Merge it into the deployment's root `vercel.json` when activating the bridge. Set `CRON_SECRET` in the ShowDart deployment; the scheduler must send `Authorization: Bearer <CRON_SECRET>`. No schedule is installed merely by adding this implementation.

The hosting plan must support a one-minute schedule. If it does not, configure an existing external scheduler to call the same authenticated endpoint every minute instead. Keep the integration disabled until a scheduler is in place. No incoming browser traffic is needed for this worker.

Result approval first saves the authoritative tournament result and its pending delivery in a single transaction. Delivery is then attempted immediately. A failed attempt remains queued, including after the browser closes. The worker claims at most five deliveries at a time, uses an attempt guard, backs off failures, and stops delivering a result after five minutes. Delivery metadata is retained for at most seven days. A delayed result for a replaced session is acknowledged without changing the new game.

Free-play has no tournament record; its approved display projection is saved durably in the same temporary delivery queue. This does not introduce a permanent free-play history feature.

## What the player sees

- Live Mickey marks for two to four board columns. Team labels remain board-side names.
- An outcome marked as awaiting approval when scoring finishes.
- The confirmed winner, or ordered final placements, after approval is saved.
- The result stays on screen for 20 seconds from its first successful delivery. Repeated delivery does not restart this period.
- Starting the next game during that hold automatically retries the screen connection after the hold. An occupied lane belonging to another session remains protected.
- After the result hold or a lost sender's lease expires, the screen recovers its normal Playground content. A subsequent ShowDart game must be started or resumed on the scoring page; the bridge does not automatically start scoring the next queued match.

New competitions receive distinct identities. Match numbers reused after a reset do not identify the old competition. The source checks this binding again on minute heartbeats and before saving a submitted result. Legacy saved competitions retain a stable `legacy` identity until reset.

## Load controls

- One current source row per lane in Playground; no duplicated tournament history.
- Only visible changes enter the publishing queue. One request is in flight and only the newest pending board is retained.
- Ordinary score publishing is capped at two updates per second, with additional enforcement in the database. Unchanged boards advance source ordering without broadcasting.
- Signed, short-lived lane grants avoid a user-authentication lookup for every scoring click. Explicit organizer allowlists are checked on requests.
- Only the affected lane is rebuilt. The existing producer remains the sole owner of display revisions and broadcasts.
- Active sessions renew around once a minute. Unchanged heartbeats do not broadcast. A linked session performs one small competition-identity lookup in the source database per heartbeat, not per click.
- Existing lane-screen recovery stays at a randomized 120–180 seconds. ShowDart setup refresh now uses tournament broadcasts and a 90–120-second safety refresh. Its older overview screens also use 120–180-second recovery instead of eight-second polling.

Broadcast from the database still consumes database work. Measure gateway requests, SQL calls and duration, database CPU, Broadcast volume, and update delay during the one-lane pilot; there is no claim that production capacity has been measured by these local tests.

## Disable or recover a lane

Press **Slå ShowDart fra** in Playground screen management. This expires the ShowDart lease and immediately rebuilds the lane's native display. Existing Playground tournaments always take precedence. Native training and ShowDart claims use the same transaction lock and cannot claim an occupied lane simultaneously.

The sender's normal lease lasts 130 seconds. A closed, crashed, or disconnected tablet cannot hold the screen indefinitely. Explicit stop/restart releases the current session. A page reload keeps the tab's session identity, while a separate tab receives a different identity and cannot silently take over the lane.

Do not remove the migrations while active code uses them. Disable the integration first if rolling back application code. Removing the server allowlists also revokes new bridge requests.

## Checks

ShowDart's `npm test` includes projection, identity, grant, ordering, burst-coalescing, retry, and delivery-acknowledgment tests. `npm run build` checks its production bundle.

Playground has focused tests in `src/lib/showdart-bridge.test.ts` for signature tampering, replay windows, authorization, invalid boards, approved rankings, payload limits, expiry, and compatibility with existing Mickey screens. Run its usual tests, type check, and lint checks.

`tests/fixtures/laneDisplay.schema.sql` and `tests/laneDisplay.integration.sql` in ShowDart are **local test files only**. The schema fixture must never be applied to an application database. They exercise the new migrations with the existing display producer on an isolated PostgreSQL instance, including competing sources, rate limits, stale revisions, expired holds, result retries, privileges, and atomic result/outbox rollback.

The bridge sends only current games and their approved results. It does not mirror the organizer's complete standings, historical results, or later manual edits made outside the scoring result API. Those would require a separate projection from the organizer's save path.

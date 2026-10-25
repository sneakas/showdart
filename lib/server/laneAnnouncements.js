import { COMPETITION_KEYS } from '../laneMatch.js';
import { buildLaneAnnouncements } from '../laneAnnouncements.js';
import { bridgeConfig, sendLaneDisplayMessage } from './laneDisplayBridge.js';

export async function readCompetitionStates(serviceClient, userId) {
  const { data, error } = await serviceClient.from('tournament_states').select('tournament_key, state_json, updated_at')
    .eq('user_id', userId).in('tournament_key', COMPETITION_KEYS);
  if (error) throw error;
  return data || [];
}

export async function saveStateWithAnnouncements(serviceClient, userId, competitionKey, state, rows, delivery = null, config = bridgeConfig()) {
  const states = Object.fromEntries(rows.map(row => [row.tournament_key, row.state_json]));
  const expected = Object.fromEntries(COMPETITION_KEYS.map(key => [key, rows.find(row => row.tournament_key === key)?.updated_at || null]));
  states[competitionKey] = state;
  const announcements = config.enabled && config.allowedUsers.has(userId) ? buildLaneAnnouncements(states, config.lanes) : [];
  const { data, error } = await serviceClient.rpc('save_showdart_state_with_announcements', {
    target_user_id: userId, target_tournament_key: competitionKey, expected_states: expected,
    target_state: state, target_announcements: announcements,
    target_event_id: delivery?.eventId || null, target_delivery: delivery
  });
  if (error) throw error;
  return data;
}

export async function deliverLaneAnnouncements(serviceClient, userId = null, send = sendLaneDisplayMessage) {
  const { data: jobs, error } = await serviceClient.rpc('claim_showdart_lane_announcements', { target_user_id: userId });
  if (error) throw error;
  let delivered = 0;
  // At most eight compact current projections; two concurrent five-second
  // requests keep retries inside the existing function's duration budget.
  for (let index = 0; index < (jobs || []).length; index += 2) {
    await Promise.all(jobs.slice(index, index + 2).map(async job => {
      let success = false;
      try {
        await send({ action: 'assignment', lane: job.lane_number, ownerId: job.user_id, revision: job.revision, board: job.payload_json });
        success = true;
        delivered += 1;
      } catch { /* The current projection stays queued until delivered or replaced. */ }
      const { error: ackError } = await serviceClient.rpc('finish_showdart_lane_announcement', {
        target_user_id: job.user_id, target_lane_number: job.lane_number, target_revision: job.revision,
        target_attempt: job.attempts, was_delivered: success
      });
      if (ackError) throw ackError;
    }));
  }
  return { delivered, attempted: jobs?.length || 0 };
}

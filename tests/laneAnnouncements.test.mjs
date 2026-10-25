import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLaneAnnouncements } from '../lib/laneAnnouncements.js';
import { deliverLaneAnnouncements, saveStateWithAnnouncements } from '../lib/server/laneAnnouncements.js';
import { TOURNAMENT_KEY, CHAMPIONSHIP_KEY, applyLaneMatchResult } from '../lib/laneMatch.js';
import { createDefaultTournamentState, normalizeTournamentState } from '../lib/tournament/reactEngine.js';
import { createDefaultChampionshipState, normalizeChampionshipState } from '../lib/championship/engine.js';

export function tournament() {
  return normalizeTournamentState({ ...createDefaultTournamentState(), tournamentName: 'Friday Cup', started: true,
    roundPublished: true, currentRound: 2, laneCount: 2, activeLanes: [1,2],
    players: [{id:1,name:'Alice'},{id:2,name:'Bob'},{id:3,name:'Carla'},{id:4,name:'Dan'}],
    matches: [
      {id:10,mode:'changing',team1PlayerIds:[1],team2PlayerIds:[2],laneNumber:1,lanePosition:1},
      {id:11,mode:'changing',team1PlayerIds:[3],team2PlayerIds:[4],laneNumber:1,lanePosition:2}
    ] });
}
export function championship() {
  return normalizeChampionshipState({ ...createDefaultChampionshipState(), tournamentName: 'Club Masters', started:true,
    roundPublished:true, phase:'initial_groups', stageRound:1, activeLanes:[1,2], config:{laneCount:2},
    teams:[{id:1,name:'A / B'},{id:2,name:'C / D'},{id:3,name:'E / F'}],
    matches:[{id:20,team1Id:1,team2Id:2,laneNumber:2,lanePosition:1,round:1}],activeMatchIds:[20] });
}
const boards = (state, lanes=[1,2]) => buildLaneAnnouncements({[TOURNAMENT_KEY]:state},lanes);

test('announces only published current pairings on the allowed lanes', () => {
  const result=boards(tournament(),[1,1]);
  assert.equal(result.length,1);
  assert.deepEqual(result[0].board.showdartPairing.names,['Alice','Bob']);
  assert.equal(result[0].board.showdartPairing.roundLabel,'Runde 2');
  assert.equal(boards(tournament())[1].board,null);
  assert.equal(boards({...tournament(),roundPublished:false})[0].board,null);
});
test('result advances the lane queue and moving a match clears its previous lane', () => {
  const state=tournament();
  const next=applyLaneMatchResult({competitionKey:TOURNAMENT_KEY,state,matchId:10,lane:1,winnerIndex:0,gameResult:{}});
  assert.deepEqual(boards(next)[0].board.showdartPairing.names,['Carla','Dan']);
  const moved={...state,matches:state.matches.map(match=>({...match,laneNumber:2}))};
  assert.equal(boards(moved)[0].board,null);
  assert.deepEqual(boards(moved)[1].board.showdartPairing.names,['Alice','Bob']);
});
test('announces all four finalists and uses a new identity after a reset', () => {
  const state=normalizeTournamentState({...tournament(),matches:[{id:12,mode:'final',participantPlayerIds:[1,2,3,4],laneNumber:1,lanePosition:1}]});
  assert.deepEqual(boards(state)[0].board.showdartPairing.names,['Alice','Bob','Carla','Dan']);
  const before=boards(state)[0].board.showdartPairing.matchKey;
  assert.notEqual(boards({...state,competitionInstanceId:crypto.randomUUID()})[0].board.showdartPairing.matchKey,before);
  assert.equal(boards(createDefaultTournamentState())[0].board,null);
});
test('championships show team labels and multi-team qualification ties', () => {
  const state=championship();
  assert.deepEqual(buildLaneAnnouncements({[CHAMPIONSHIP_KEY]:state},[2])[0].board.showdartPairing.names,['A / B','C / D']);
  const tie=normalizeChampionshipState({...state,matches:[{...state.matches[0],stage:'tiebreak',isTieBreak:true,isMultiTeamTieBreak:true,participantIds:[1,2,3]}]});
  assert.deepEqual(buildLaneAnnouncements({[CHAMPIONSHIP_KEY]:tie},[2])[0].board.showdartPairing.names,['A / B','C / D','E / F']);
  assert.equal(buildLaneAnnouncements({[CHAMPIONSHIP_KEY]:{...state,roundPublished:false}},[2])[0].board,null);
});
test('screen selection agrees with the scoring competition and excludes private state', () => {
  const state={...tournament(),privateNote:'NEVER SHOW',auditLog:[{password:'NEVER SHOW'}]};
  const result=buildLaneAnnouncements({[TOURNAMENT_KEY]:state,[CHAMPIONSHIP_KEY]:championship()},[1,2]);
  assert.equal(result[0].board.showdartPairing.competitionName,'Friday Cup');
  assert.equal(JSON.stringify(result).includes('NEVER SHOW'),false);
  const result2=buildLaneAnnouncements({[TOURNAMENT_KEY]:{...state,roundPublished:false},[CHAMPIONSHIP_KEY]:championship()},[2]);
  assert.equal(result2[0].board.showdartPairing.competitionName,'Club Masters');
});
test('saving submits both comparison versions and queues nothing for unauthorized owners', async () => {
  const calls=[];
  const service={rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true,updatedAt:'now'}};}};
  const config={enabled:true,allowedUsers:new Set(['owner']),lanes:[1]};
  const rows=[{tournament_key:CHAMPIONSHIP_KEY,state_json:championship(),updated_at:'old'}];
  await saveStateWithAnnouncements(service,'owner',TOURNAMENT_KEY,tournament(),rows,null,config);
  assert.deepEqual(calls[0].args.expected_states,{[TOURNAMENT_KEY]:null,[CHAMPIONSHIP_KEY]:'old'});
  assert.equal(calls[0].args.target_announcements.length,1);
  await saveStateWithAnnouncements(service,'unauthorized',TOURNAMENT_KEY,tournament(),rows,null,config);
  assert.deepEqual(calls[1].args.target_announcements,[]);
});
test('failed delivery stays queued; acknowledgments bind revision and attempt', async () => {
  const acks=[];
  const service={rpc:async(name,args)=> name==='claim_showdart_lane_announcements'
    ? {data:[{user_id:'owner',lane_number:1,revision:20,attempts:2,payload_json:boards(tournament())[0].board},{user_id:'owner',lane_number:2,revision:21,attempts:1,payload_json:null}]}
    : (acks.push(args),{error:null})};
  const result=await deliverLaneAnnouncements(service,'owner',async message=>{if(message.lane===1) throw new Error('offline');});
  assert.deepEqual(result,{delivered:1,attempted:2});
  assert.equal(acks.find(ack=>ack.target_lane_number===1).was_delivered,false);
  assert.equal(acks.find(ack=>ack.target_lane_number===2).target_revision,21);
  assert.equal(acks.find(ack=>ack.target_lane_number===2).was_delivered,true);
});

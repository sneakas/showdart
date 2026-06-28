'use client';

import { ArrowDown, ArrowUp, CalendarDays, Check, Eye, EyeOff, ExternalLink, Gamepad2, GitBranch, History, Medal, MoreVertical, Plus, QrCode, RefreshCw, RotateCcw, ShieldCheck, Trophy, Upload, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addFixedTeam,
  addPlayer,
  assignMatchLane,
  approveTagChanges,
  canManageEntriesBetweenRounds,
  completeRound,
  completeFinal,
  configureTournament,
  eliminateEntry,
  generateMatches,
  getActiveEntries,
  getEntries,
  getMatchLaneStatus,
  getMatchLabel,
  getSkippedEntries,
  getSortedStandings,
  importEntries,
  normalizeTournamentState,
  publishRound,
  removeEntry,
  resetTournament,
  moveMatchInLaneQueue,
  selectWinner,
  setActiveLane,
  showStandingsOverride,
  hidePublishedRound,
  startFinalMatch,
  startTournament,
  togglePlayerTag,
  updateTvScreen,
  updateEntryLosses,
  updateTournamentMaxLosses
} from '../../lib/tournament/reactEngine';

const HERO_VISIBILITY_STORAGE_KEY = 'showdart-hide-admin-hero';
const TV_CONTROL_VISIBILITY_STORAGE_KEY = 'showdart-hide-tv-control';

const texts = {
  da: {
    tournament: 'Turnering',
    championship: 'Mesterskab',
    game: 'Spil',
    admin: 'Admin',
    rules: 'Regler',
    rulesTitle: 'Turneringsregler',
    rulesChangingTitle: 'Regler for skiftende makkere',
    rulesFixedTitle: 'Regler for faste makkere',
    rulesChanging: [
      'Spillere skal registreres, før turneringen begynder.',
      'Turneringslederen bestemmer, hvor mange nederlag en spiller kan få før eliminering, baseret på antallet af deltagere.',
      'Aktive spillere fordeles tilfældigt i hold på 2 for 2v2-kampe i hver runde.',
      'Fairness-motoren forsøger at undgå gentagne makkere og gentagne modstandere på tværs af runder.',
      'Særlige regler gælder, når der ikke er nok spillere til lige 2v2-kampe: Hvis 3 spillere forbliver uparrede, spiller 2 en 1v1-kamp, og 1 sidder over.',
      'Hvis 2 spillere forbliver uparrede, spiller de en 1v1-kamp.',
      'Hvis 1 spiller forbliver uparret, sidder spilleren over.',
      '"S" tag bruges til spillere, der har spillet i en 1v1-kamp.',
      '"O" tag bruges til spillere, der har siddet over.',
      'Tags tildeles automatisk efter kampene genereres i hver runde, og turneringslederen kan manuelt tilføje eller fjerne tags mellem runder.',
      'Spillere med "S" tag prioriteres væk fra 1v1-kampe, indtil alle andre aktive spillere har modtaget "S" tags.',
      'Spillere med "O" tag prioriteres væk fra at sidde over, indtil alle andre aktive spillere har modtaget "O" tags.',
      'Når alle aktive spillere har fået samme tag, nulstilles tag-cyklussen automatisk. Hvis den sidste spiller uden S-tag spiller 1v1 mod en spiller, der allerede har S-tag, beholder begge S-tag, og de øvrige nulstilles.',
      'Baner vælges før næste runde genereres. Efter runden er genereret, kan turneringslederen stadig ændre bane på hver kamp manuelt.',
      'Hvis der er flere kampe end aktive baner, fordeles de automatisk i banekøer. Den næste kamp på en bane bliver klar, når den tidligere kamp har fået markeret en vinder.',
      'En ny runde oprettes som kladde. Kampe og baner vises først på publikumsskærmene, når turneringslederen offentliggør runden.',
      'Efter hver runde markeres vinderne, og taberne modtager 1 nederlag.',
      'Når en spiller bliver elimineret, vises elimineringsrunden i spillerens status, f.eks. "Elimineret R3".',
      'Mellem runder kan turneringslederen rette nederlag, gendanne eliminerede spillere ved at sænke nederlag, tilføje spillere, ændre tags og se kamphistorik.',
      'Tilskuerskærmen viser stilling mellem runder, aktuelle kampe under runden, vindere når de markeres, og kan midlertidigt vise stillingen i 30 sekunder.',
      'Når 5 eller færre aktive spillere er tilbage, kan turneringslederen starte en finale. I finalen rangeres de resterende spillere manuelt fra 1. plads til sidste plads.'
    ],
    rulesFixed: [
      'Hold skal registreres som to faste spillere, før turneringen starter.',
      'Turneringslederen bestemmer, hvor mange nederlag et hold må få, før det elimineres.',
      'De samme to spillere bliver på holdet under hele turneringen og spiller altid sammen.',
      'Kampe genereres som hold mod hold i hver runde.',
      'Fairness-motoren forsøger at undgå gentagne opgør mellem de samme hold.',
      'Hvis et ulige antal hold er aktive, sidder ét hold over i runden.',
      'Systemet forsøger at undgå, at det samme hold sidder over to runder i træk.',
      '"O" tag bruges til hold, der har siddet over.',
      'Hold med "O" tag prioriteres væk fra at sidde over, indtil alle andre aktive hold har modtaget "O" tags.',
      'Når alle aktive hold har fået "O" tag, nulstilles O-tag-cyklussen automatisk.',
      'Baner vælges før næste runde genereres. Efter runden er genereret, kan turneringslederen stadig ændre bane på hver kamp manuelt.',
      'Hvis der er flere kampe end aktive baner, fordeles de automatisk i banekøer. Den næste kamp på en bane bliver klar, når den tidligere kamp har fået markeret en vinder.',
      'En ny runde oprettes som kladde. Kampe og baner vises først på publikumsskærmene, når turneringslederen offentliggør runden.',
      'Efter hver runde modtager det tabende hold 1 nederlag.',
      'Når et hold når det maksimale antal nederlag, bliver det elimineret, og elimineringsrunden vises i oversigten.',
      'Mellem runder kan turneringslederen rette nederlag, gendanne eliminerede hold ved at sænke nederlag, tilføje hold, ændre baner og se kamphistorik.',
      'Tilskuerskærmen viser stilling mellem runder, aktuelle kampe under runden, vindere når de markeres, og kan midlertidigt vise stillingen i 30 sekunder.',
      'Når 5 eller færre aktive hold er tilbage, kan turneringslederen starte en finale. I finalen rangeres de resterende hold manuelt fra 1. plads til sidste plads.'
    ],
    logout: 'Log ud',
    brandSub: 'Turnering',
    setup: 'Turneringsopsætning',
    quick: 'Hurtige handlinger',
    participants: 'Deltagere',
    lanes: 'Baner',
    currentRound: 'Aktuel runde',
    nextRound: 'Næste runde',
    addParticipant: 'Tilføj deltager',
    importParticipants: 'Importer deltagere',
    bracket: 'Se turneringstræ',
    editSetup: 'Redigér opsætning',
    spectator: 'Publikumsskærm',
    tvControl: 'TV-skærme',
    screenOne: 'Skærm 1',
    screenTwo: 'Skærm 2',
    tvMode: 'Visning',
    tvRows: 'Rækker',
    tvMatchesPerPage: 'Kampe/side',
    tvRotation: 'Skift sek.',
    tvQr: 'QR',
    tvAnnouncement: 'Besked',
    tvAnnouncementPlaceholder: 'Skriv besked til publikum...',
    tvPublishAnnouncement: 'Vis besked',
    tvClearAnnouncement: 'Skjul besked',
    tvHideHeader: 'Skjul top',
    tvAutoHideHeader: 'Auto-skjul top',
    tvTheme: 'Tema',
    themeClassic: 'Klassisk',
    themeHighContrast: 'Høj kontrast',
    themeLight: 'Lys',
    themeMinimal: 'Minimal',
    modeAuto: 'Auto',
    modeLive: 'Kampe',
    modeStandings: 'Stilling',
    modeInfo: 'Info / QR',
    modeLanes: 'Baner',
    modeRotating: 'Roterende',
    modeFinal: 'Resultater',
    openSpectator: 'Åbn publikumsskærm',
    copy: 'Kopier link',
    liveActive: 'Live opdateringer aktive',
    tournamentName: 'Turneringsnavn',
    format: 'Turneringsformat',
    participantsCount: 'Antal deltagere',
    lanesCount: 'Antal baner',
    losses: 'Nederlag',
    saveLossLimit: 'Gem nederlagsgrænse',
    save: 'Gem',
    confirmLossLimit: 'Vil du ændre nederlagsgrænsen fra {old} til {next}? Deltagernes aktive eller eliminerede status bliver genberegnet ud fra deres nuværende nederlag.',
    status: 'Status',
    started: 'I gang',
    waiting: 'Venter',
    active: 'I spil',
    start: 'Start turnering',
    generate: 'Generer næste runde',
    publishRound: 'Offentliggør runde',
    hideRound: 'Skjul runde',
    roundDraft: 'Kladde – ikke offentliggjort',
    roundLive: 'Runden er offentliggjort',
    confirmPublishRound: 'Er du sikker på, at runden og alle banekøer er korrekte? Når runden offentliggøres, bliver kampe og baner straks vist på publikumsskærmene.',
    confirmHideRound: 'Vil du skjule runden fra publikumsskærmene igen? Dette kan kun gøres, før en vinder er markeret.',
    complete: 'Afslut runde',
    reset: 'Nulstil turnering',
    showStandings: 'Vis stilling 30 sek.',
    approveTags: 'Godkend tag ændringer',
    history: 'Vis historik',
    hideHistory: 'Skjul historik',
    standingsTree: 'Se turneringstræ',
    hideStandingsTree: 'Skjul turneringstræ',
    hideWorkspaceHeader: 'Skjul topfelt',
    showWorkspaceHeader: 'Vis topfelt',
    hideTvControl: 'Skjul TV-skærme',
    showTvControl: 'Vis TV-skærme',
    startFinal: 'Start finale',
    confirmFinal: 'Bekræft finaleresultat',
    finalRanking: 'Finalerangering',
    finalResults: 'Slutresultat',
    tags: 'Tags',
    place: 'Placering',
    eliminated: 'Ude',
    remove: 'Fjern',
    eliminate: 'Eliminér',
    editBetweenRoundsOnly: 'Ændringer kan kun laves mellem runder.',
    minSingles: 'Der skal være mindst 4 spillere for at starte turneringen.',
    minPairs: 'Der skal være mindst 2 hold for at starte turneringen.',
    confirmStartIntro: 'Er du sikker på, at du vil starte turneringen med disse indstillinger?',
    confirmStartName: 'Turneringsnavn',
    confirmStartEntries: 'Deltagere',
    confirmStartTeams: 'Hold',
    confirmStartFormat: 'Format',
    confirmStartLosses: 'Maks. nederlag',
    confirmStartLanes: 'Baner',
    confirmDisableLane: 'Bane {lane} har {count} uafsluttede kamp(e). Hvis du deaktiverer banen, flyttes de automatisk til køerne på de øvrige aktive baner. Vil du fortsætte?',
    confirmCompleteRound: 'Er du sikker på, at du vil afslutte runden? Tabere får nederlag, og runden gemmes i historikken.',
    confirmEliminateEntry: 'Er du sikker på, at du vil sætte {name} ud af turneringen?',
    confirmRemoveEntry: 'Er du sikker på, at du vil fjerne {name} fra turneringen?',
    confirmFinalResult: 'Er du sikker på, at finalerangeringen er korrekt? Slutresultatet bliver gemt.',
    confirmReset: 'Er du sikker på, at du vil nulstille hele turneringen? Alle kampe, spillere og resultater bliver slettet.',
    confirmFinalStart: 'Er du sikker på, at du vil starte finalen nu? Du skal rangere de resterende deltagere manuelt.',
    warningTitle: 'Bekræft handling',
    errorTitle: 'Turneringsbesked',
    ok: 'OK',
    cancel: 'Annuller',
    continue: 'Fortsæt',
    changing: 'Skiftende makkere',
    fixed: 'Faste makkere',
    name: 'Navn',
    roleStatus: 'Status',
    seed: 'Seed',
    all: 'Alle',
    search: 'Søg deltagere...',
    playerName: 'Spillernavn',
    memberOne: 'Spiller 1',
    memberTwo: 'Spiller 2',
    add: 'Tilføj',
    round: 'Runde',
    match: 'Kamp',
    matches: 'Kampe',
    historyStatus: 'Status',
    historyPlaying: 'Spiller',
    historySingles: 'Singlekamp',
    ready: 'Klar til kamp',
    laneCurrent: 'Spiller nu',
    laneQueued: 'Næste kamp',
    laneCompleted: 'Afsluttet',
    laneUnassigned: 'Venter på bane',
    queuePosition: 'Køplads',
    moveQueueUp: 'Flyt frem i køen',
    moveQueueDown: 'Flyt tilbage i køen',
    winner: 'Vinder',
    selectWinner: 'Markér vinder',
    sitOver: 'Sidder over',
    noMatches: 'Ingen kampe genereret endnu',
    statusLabel: 'Turneringsstatus',
    current: 'Aktuel runde',
    matchesPlayed: 'Kampe spillet',
    lanesInUse: 'Baner i brug',
    lastUpdate: 'Sidste opdatering'
  },
  en: {
    tournament: 'Tournament',
    championship: 'Championship',
    game: 'Game',
    admin: 'Admin',
    rules: 'Rules',
    rulesTitle: 'Tournament rules',
    rulesChangingTitle: 'Rules for changing teammates',
    rulesFixedTitle: 'Rules for fixed teammates',
    rulesChanging: [
      'Players must register before the tournament begins.',
      'The tournament director decides how many losses a player can get before elimination based on the number of participants.',
      'Active players are randomly split into teams of 2 for 2v2 matches each round.',
      'The fairness engine tries to avoid repeated partners and repeated opponents across rounds.',
      'Special rules apply when there are not enough players for even 2v2 matches: If 3 players remain unmatched, 2 play a 1v1 match and 1 sits out.',
      'If 2 players remain unmatched, they play a 1v1 match.',
      'If 1 player remains unmatched, that player sits out.',
      '"S" tag is used for players who have played in a 1v1 match.',
      '"O" tag is used for players who have sat out.',
      'Tags are assigned automatically after generating matches for each round, and the tournament director can manually add or remove tags between rounds.',
      'Players with "S" tag are prioritized away from 1v1 matches until all other active players have received "S" tags.',
      'Players with "O" tag are prioritized away from sitting out until all other active players have received "O" tags.',
      'When all active players have received the same tag, that tag cycle resets automatically. If the last player without S tag plays 1v1 against a player who already has S tag, both keep S tag and the others are reset.',
      'Lanes are selected before the next round is generated. After the round is generated, the tournament director can still manually change the lane for each match.',
      'When there are more matches than active lanes, they are automatically distributed into lane queues. The next match becomes ready when a winner is recorded for the earlier match.',
      'A new round is created as a draft. Matches and lanes appear on spectator screens only after the tournament director publishes the round.',
      'After each round, winners are marked and losers receive 1 loss.',
      'When a player is eliminated, the elimination round is shown in their status, e.g. "Eliminated R3".',
      'Between rounds the tournament director can edit losses, restore eliminated players by lowering losses, add players, change tags and view match history.',
      'The spectator screen shows standings between rounds, current matches during the round, winners as soon as they are marked, and can temporarily show standings for 30 seconds.',
      'When 5 or fewer active players remain, the tournament director can start a final. In the final, remaining players are ranked manually from 1st place to last place.'
    ],
    rulesFixed: [
      'Teams must be registered as two fixed players before the tournament starts.',
      'The tournament director decides how many losses a team may receive before elimination.',
      'The same two players stay together for the entire tournament and always play as one team.',
      'Matches are generated as team-versus-team pairings each round.',
      'The fairness engine tries to avoid repeated matchups between the same teams.',
      'If an odd number of teams remain active, one team sits out for the round.',
      'The system tries to avoid giving the same team a sit-out in consecutive rounds.',
      '"O" tag is used for teams that have sat out.',
      'Teams with "O" tag are prioritized away from sitting out until all other active teams have received "O" tags.',
      'When all active teams have received the "O" tag, the O-tag cycle resets automatically.',
      'Lanes are selected before the next round is generated. After the round is generated, the tournament director can still manually change the lane for each match.',
      'When there are more matches than active lanes, they are automatically distributed into lane queues. The next match becomes ready when a winner is recorded for the earlier match.',
      'A new round is created as a draft. Matches and lanes appear on spectator screens only after the tournament director publishes the round.',
      'After each round, the losing team receives 1 loss.',
      'When a team reaches the maximum number of losses, it is eliminated and its elimination round is shown in the standings.',
      'Between rounds the tournament director can edit losses, restore eliminated teams by lowering losses, add teams, change lanes and view match history.',
      'The spectator screen shows standings between rounds, current matches during the round, winners as soon as they are marked, and can temporarily show standings for 30 seconds.',
      'When 5 or fewer active teams remain, the tournament director can start a final. In the final, remaining teams are ranked manually from 1st place to last place.'
    ],
    logout: 'Logout',
    brandSub: 'Tournament',
    setup: 'Tournament setup',
    quick: 'Quick actions',
    participants: 'Participants',
    lanes: 'Lanes',
    currentRound: 'Current round',
    nextRound: 'Next round',
    addParticipant: 'Add participant',
    importParticipants: 'Import participants',
    bracket: 'View bracket',
    editSetup: 'Edit setup',
    spectator: 'Spectator screen',
    tvControl: 'TV screens',
    screenOne: 'Screen 1',
    screenTwo: 'Screen 2',
    tvMode: 'View',
    tvRows: 'Rows',
    tvMatchesPerPage: 'Matches/page',
    tvRotation: 'Rotate sec.',
    tvQr: 'QR',
    tvAnnouncement: 'Message',
    tvAnnouncementPlaceholder: 'Write message to spectators...',
    tvPublishAnnouncement: 'Show message',
    tvClearAnnouncement: 'Hide message',
    tvHideHeader: 'Hide header',
    tvAutoHideHeader: 'Auto-hide header',
    tvTheme: 'Theme',
    themeClassic: 'Classic',
    themeHighContrast: 'High contrast',
    themeLight: 'Light',
    themeMinimal: 'Minimal',
    modeAuto: 'Auto',
    modeLive: 'Matches',
    modeStandings: 'Standings',
    modeInfo: 'Info / QR',
    modeLanes: 'Lanes',
    modeRotating: 'Rotating',
    modeFinal: 'Results',
    openSpectator: 'Open spectator screen',
    copy: 'Copy link',
    liveActive: 'Live updates active',
    tournamentName: 'Tournament name',
    format: 'Tournament format',
    participantsCount: 'Participants',
    lanesCount: 'Lanes',
    losses: 'Losses',
    saveLossLimit: 'Save loss limit',
    save: 'Save',
    confirmLossLimit: 'Do you want to change the loss limit from {old} to {next}? Participant eligibility will be recalculated from their current losses.',
    status: 'Status',
    started: 'In progress',
    waiting: 'Waiting',
    active: 'In play',
    start: 'Start tournament',
    generate: 'Generate next round',
    publishRound: 'Publish round',
    hideRound: 'Hide round',
    roundDraft: 'Draft – not published',
    roundLive: 'Round is published',
    confirmPublishRound: 'Are you sure the round and all lane queues are correct? Publishing immediately shows the matches and lanes on the spectator screens.',
    confirmHideRound: 'Do you want to hide the round from spectator screens again? This is only possible before a winner has been selected.',
    complete: 'Complete round',
    reset: 'Reset tournament',
    showStandings: 'Show standings 30 sec.',
    approveTags: 'Approve tag changes',
    history: 'Show history',
    hideHistory: 'Hide history',
    standingsTree: 'View tournament tree',
    hideStandingsTree: 'Hide tournament tree',
    hideWorkspaceHeader: 'Hide top panel',
    showWorkspaceHeader: 'Show top panel',
    hideTvControl: 'Hide TV screens',
    showTvControl: 'Show TV screens',
    startFinal: 'Start final',
    confirmFinal: 'Confirm final results',
    finalRanking: 'Final ranking',
    finalResults: 'Final results',
    tags: 'Tags',
    place: 'Place',
    eliminated: 'Out',
    remove: 'Remove',
    eliminate: 'Eliminate',
    editBetweenRoundsOnly: 'Edits can only be made between rounds.',
    minSingles: 'At least 4 players are required to start the tournament.',
    minPairs: 'At least 2 teams are required to start the tournament.',
    confirmStartIntro: 'Are you sure you want to start the tournament with these settings?',
    confirmStartName: 'Tournament name',
    confirmStartEntries: 'Participants',
    confirmStartTeams: 'Teams',
    confirmStartFormat: 'Format',
    confirmStartLosses: 'Max losses',
    confirmStartLanes: 'Lanes',
    confirmDisableLane: 'Lane {lane} has {count} unfinished match(es). If you disable it, they will automatically move to the queues on the remaining active lanes. Do you want to continue?',
    confirmCompleteRound: 'Are you sure you want to complete the round? Losers receive losses and the round is saved to history.',
    confirmEliminateEntry: 'Are you sure you want to eliminate {name} from the tournament?',
    confirmRemoveEntry: 'Are you sure you want to remove {name} from the tournament?',
    confirmFinalResult: 'Are you sure the final ranking is correct? The final result will be saved.',
    confirmReset: 'Are you sure you want to reset the whole tournament? All matches, players and results will be deleted.',
    confirmFinalStart: 'Are you sure you want to start the final now? You will need to rank the remaining entries manually.',
    warningTitle: 'Confirm action',
    errorTitle: 'Tournament message',
    ok: 'OK',
    cancel: 'Cancel',
    continue: 'Continue',
    changing: 'Changing teammates',
    fixed: 'Fixed teammates',
    name: 'Name',
    roleStatus: 'Status',
    seed: 'Seed',
    all: 'All',
    search: 'Search participants...',
    playerName: 'Player name',
    memberOne: 'Player 1',
    memberTwo: 'Player 2',
    add: 'Add',
    round: 'Round',
    match: 'Match',
    matches: 'Matches',
    historyStatus: 'Status',
    historyPlaying: 'Playing',
    historySingles: 'Singles',
    ready: 'Ready to play',
    laneCurrent: 'Playing now',
    laneQueued: 'Next match',
    laneCompleted: 'Completed',
    laneUnassigned: 'Waiting for lane',
    queuePosition: 'Queue position',
    moveQueueUp: 'Move forward in queue',
    moveQueueDown: 'Move back in queue',
    winner: 'Winner',
    selectWinner: 'Select winner',
    sitOver: 'Sitting out',
    noMatches: 'No matches generated yet',
    statusLabel: 'Tournament status',
    current: 'Current round',
    matchesPlayed: 'Matches played',
    lanesInUse: 'Lanes in use',
    lastUpdate: 'Last update'
  }
};

export function ShowdartDashboard({
  lang,
  role,
  email,
  session,
  screenInfo,
  screenNotice,
  screenError,
  onCopyScreenLink,
  onOpenAdmin,
  onOpenChampionship,
  onOpenGame,
  onOpenRules,
  onLogout,
  onLanguageChange,
  onStateSync
}) {
  const t = texts[lang] || texts.da;
  const [state, setState] = useState(() => normalizeTournamentState(null));
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    tournamentName: '',
    teammateMode: 'changing',
    maxLosses: 2,
    laneCount: 4
  });
  const [playerName, setPlayerName] = useState('');
  const [memberOne, setMemberOne] = useState('');
  const [memberTwo, setMemberTwo] = useState('');
  const [search, setSearch] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [treeVisible, setTreeVisible] = useState(false);
  const [finalRankingIds, setFinalRankingIds] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [announcementDrafts, setAnnouncementDrafts] = useState({ screen1: '', screen2: '' });
  const [heroHidden, setHeroHidden] = useState(false);
  const [tvControlHidden, setTvControlHidden] = useState(false);
  const importInputRef = useRef(null);
  const previousAnnouncementsRef = useRef({ screen1: '', screen2: '' });

  const token = session?.access_token;
  const entries = useMemo(() => getEntries(state), [state]);
  const activeEntries = useMemo(() => getActiveEntries(state), [state]);
  const standings = useMemo(() => getSortedStandings(state), [state]);
  const skippedEntries = useMemo(() => getSkippedEntries(state), [state]);
  const isRoundActive = state.matches.length > 0 || skippedEntries.length > 0;
  const canManageEntries = canManageEntriesBetweenRounds(state);
  const canEditEntries = !state.started || canManageEntries;
  const canAddEntries = !state.started || canManageEntries;
  const canApproveTags = state.pendingTagChanges && canManageEntries;
  const tournamentFinished = Boolean(state.finalResults || state.finalResultPlayerIds || state.finalResultTeamIds);
  const canStartFinal = state.started && !tournamentFinished && !isRoundActive && activeEntries.length > 1 && activeEntries.length <= 5;
  const finalPlacements = useMemo(() => buildFinalPlacements(entries, state), [entries, state]);
  const matchesPlayed = state.roundHistory?.reduce((total, round) => total + (round.matches?.length || 0), 0) || 0;
  const registrationMode = state.started ? state.teammateMode : form.teammateMode;

  function showDialog(message, options = {}) {
    if (!message) return;
    setNotice(message);
    setDialog({
      kind: options.kind || 'alert',
      title: options.title || t.errorTitle,
      message,
      confirmLabel: options.confirmLabel || t.ok,
      cancelLabel: options.cancelLabel || t.cancel,
      onConfirm: options.onConfirm || null
    });
  }

  function showConfirm(message, onConfirm) {
    showDialog(message, {
      kind: 'confirm',
      title: t.warningTitle,
      confirmLabel: t.continue,
      cancelLabel: t.cancel,
      onConfirm
    });
  }

  function closeDialog() {
    setDialog(null);
  }

  function confirmDialog() {
    const action = dialog?.onConfirm;
    setDialog(null);
    action?.();
  }

  const persist = useCallback(async nextState => {
    if (!token) return;
    await fetch('/api/tournament-state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id: 'showdart-default', state: nextState })
    });
    onStateSync?.({
      tournamentId: 'showdart-default',
      state: nextState,
      updatedAt: new Date().toISOString()
    });
  }, [onStateSync, token]);

  const commit = useCallback(updater => {
    setState(previous => {
      const next = normalizeTournamentState(typeof updater === 'function' ? updater(previous) : updater);
      persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }, [persist, showDialog]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      const response = await fetch('/api/tournament-state?id=showdart-default', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (cancelled) return;
      if (response.ok) {
        const payload = await response.json();
        const next = normalizeTournamentState(payload.state);
        setState(next);
        setForm({
          tournamentName: next.tournamentName || '',
          teammateMode: next.teammateMode,
          maxLosses: next.maxLosses,
          laneCount: next.laneCount
        });
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHeroHidden(window.localStorage.getItem(HERO_VISIBILITY_STORAGE_KEY) === '1');
    setTvControlHidden(window.localStorage.getItem(TV_CONTROL_VISIBILITY_STORAGE_KEY) === '1');
  }, []);

  useEffect(() => {
    setAnnouncementDrafts(previous => {
      const next = { ...previous };
      let changed = false;
      ['screen1', 'screen2'].forEach(screenKey => {
        const liveAnnouncement = state.tvScreens?.[screenKey]?.announcement || '';
        const previousLiveAnnouncement = previousAnnouncementsRef.current[screenKey] || '';
        if ((next[screenKey] || '') === previousLiveAnnouncement && next[screenKey] !== liveAnnouncement) {
          next[screenKey] = liveAnnouncement;
          changed = true;
        }
        previousAnnouncementsRef.current[screenKey] = liveAnnouncement;
      });
      return changed ? next : previous;
    });
  }, [state.tvScreens]);

  function navButton(key, label, Icon, onClick) {
    return (
      <button type="button" className={key === 'tournament' ? 'is-active' : ''} onClick={onClick} aria-current={key === 'tournament' ? 'page' : undefined}>
        <Icon size={20} strokeWidth={1.8} />
        {label}
      </button>
    );
  }

  function handleAddEntry(event) {
    event.preventDefault();
    if (!canAddEntries) {
      showDialog(t.editBetweenRoundsOnly);
      return;
    }
    commit(previous => registrationMode === 'fixed'
      ? addFixedTeam(previous, memberOne, memberTwo)
      : addPlayer(previous, playerName));
    setPlayerName('');
    setMemberOne('');
    setMemberTwo('');
  }

  function handleStart() {
    const minimumEntries = form.teammateMode === 'fixed' ? 2 : 4;
    const entryCount = form.teammateMode === 'fixed' ? state.fixedTeams.length : state.players.length;
    if (entryCount < minimumEntries) {
      showDialog(form.teammateMode === 'fixed' ? t.minPairs : t.minSingles);
      return;
    }
    const nextConfig = {
      tournamentName: form.tournamentName || 'Klubmesterskab 2025',
      teammateMode: form.teammateMode,
      maxLosses: form.maxLosses,
      laneCount: form.laneCount
    };
    const entryLabel = nextConfig.teammateMode === 'fixed' ? t.confirmStartTeams : t.confirmStartEntries;
    const modeLabel = nextConfig.teammateMode === 'fixed' ? t.fixed : t.changing;
    showConfirm(
      [
        t.confirmStartIntro,
        '',
        `${t.confirmStartName}: ${nextConfig.tournamentName}`,
        `${entryLabel}: ${entryCount}`,
        `${t.confirmStartFormat}: ${modeLabel}`,
        `${t.confirmStartLosses}: ${nextConfig.maxLosses}`,
        `${t.confirmStartLanes}: ${nextConfig.laneCount}`
      ].join('\n'),
      () => {
        setForm(nextConfig);
        setState(previous => {
          const next = normalizeTournamentState(startTournament(configureTournament(previous, nextConfig), nextConfig));
          if (next.lastGenerationError) showDialog(next.lastGenerationError);
          persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
          return next;
        });
      }
    );
  }

  function handleTournamentFormatChange(value) {
    const nextForm = { ...form, teammateMode: value };
    setForm(nextForm);
    if (!state.started) {
      commit(previous => configureTournament(previous, nextForm));
    }
  }

  function handleSetupChange(patch) {
    const nextForm = { ...form, ...patch };
    setForm(nextForm);
    if (!state.started) {
      commit(previous => configureTournament(previous, nextForm));
    }
  }

  function handleSaveMaxLosses() {
    const nextLimit = Math.max(1, Math.min(20, Number(form.maxLosses) || state.maxLosses));
    if (nextLimit === state.maxLosses) return;
    showConfirm(
      t.confirmLossLimit.replace('{old}', String(state.maxLosses)).replace('{next}', String(nextLimit)),
      () => {
        setState(previous => {
          const next = normalizeTournamentState(updateTournamentMaxLosses(previous, nextLimit));
          if (next.lastGenerationError) {
            showDialog(next.lastGenerationError);
            setForm(current => ({ ...current, maxLosses: previous.maxLosses }));
          } else {
            setForm(current => ({ ...current, maxLosses: next.maxLosses }));
          }
          persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
          return next;
        });
      }
    );
  }

  function handleGenerate() {
    setState(previous => {
      const next = normalizeTournamentState(generateMatches(previous));
      if (next.lastGenerationError) showDialog(next.lastGenerationError);
      persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }

  function handlePublishRound() {
    const queuedCount = state.matches.filter(match => Number(match.lanePosition) > 1).length;
    showConfirm(
      [
        t.confirmPublishRound,
        '',
        `${t.matches}: ${state.matches.length}`,
        `${t.lanes}: ${state.activeLanes.length}`,
        `${t.laneQueued}: ${queuedCount}`
      ].join('\n'),
      () => {
        setState(previous => {
          const next = normalizeTournamentState(publishRound(previous));
          if (next.lastGenerationError) showDialog(next.lastGenerationError);
          persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
          return next;
        });
      }
    );
  }

  function handleHideRound() {
    showConfirm(t.confirmHideRound, () => {
      setState(previous => {
        const next = normalizeTournamentState(hidePublishedRound(previous));
        if (next.lastGenerationError) showDialog(next.lastGenerationError);
        persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
        return next;
      });
    });
  }

  function handleAssignLane(matchId, lane) {
    setState(previous => {
      const next = normalizeTournamentState(assignMatchLane(previous, matchId, lane));
      if (next.lastGenerationError) showDialog(next.lastGenerationError);
      persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }

  function handleMoveMatchQueue(matchId, direction) {
    setState(previous => {
      const next = normalizeTournamentState(moveMatchInLaneQueue(previous, matchId, direction));
      if (next.lastGenerationError) showDialog(next.lastGenerationError);
      persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }

  function handleSelectWinner(matchId, winner) {
    setState(previous => {
      const next = normalizeTournamentState(selectWinner(previous, matchId, winner));
      if (next.lastGenerationError) showDialog(next.lastGenerationError);
      persist(next).catch(error => showDialog(error instanceof Error ? error.message : 'Save failed'));
      return next;
    });
  }

  function handleToggleLane(lane, active) {
    if (active) {
      const assignedCount = state.matches.filter(match => match.laneNumber === lane && !match.winner).length;
      if (assignedCount > 0) {
        showConfirm(
          t.confirmDisableLane
            .replace('{lane}', String(lane))
            .replace('{count}', String(assignedCount)),
          () => commit(previous => setActiveLane(previous, lane, false))
        );
        return;
      }
    }
    commit(previous => setActiveLane(previous, lane, !active));
  }

  function handleComplete() {
    if (state.matches.some(match => !match.winner)) {
      showDialog('Marker vinder i alle kampe først.');
      return;
    }
    showConfirm(t.confirmCompleteRound, () => {
      commit(previous => completeRound(previous));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!canAddEntries) {
      showDialog(t.editBetweenRoundsOnly);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      commit(previous => importEntries(previous, String(reader.result || '')));
    };
    reader.readAsText(file);
  }

  function handleEntryAction(entry) {
    if (state.started && !canManageEntries) {
      showDialog(t.editBetweenRoundsOnly);
      return;
    }
    if (state.started && entry.active !== false) {
      showConfirm(t.confirmEliminateEntry.replace('{name}', entry.name), () => {
        commit(previous => eliminateEntry(previous, entry.id));
      });
      return;
    }
    showConfirm(t.confirmRemoveEntry.replace('{name}', entry.name), () => {
      commit(previous => removeEntry(previous, entry.id));
    });
  }

  function handleStartFinal() {
    showConfirm(t.confirmFinalStart, () => {
      setFinalRankingIds(activeEntries.map(entry => entry.id));
      commit(previous => startFinalMatch(previous));
    });
  }

  function handleResetTournament() {
    showConfirm(t.confirmReset, () => {
      setFinalRankingIds([]);
      setHistoryVisible(false);
      setTreeVisible(false);
      commit(resetTournament());
    });
  }

  function moveFinalist(id, direction) {
    setFinalRankingIds(previous => {
      const next = [...previous];
      const index = next.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleCompleteFinal() {
    showConfirm(t.confirmFinalResult, () => {
      commit(previous => completeFinal(previous, finalRankingIds));
      setFinalRankingIds([]);
    });
  }

  function getScreenUrl(screenKey) {
    if (!screenInfo?.screenUrl) return '';
    return `${screenInfo.screenUrl}${screenInfo.screenUrl.includes('?') ? '&' : '?'}view=${encodeURIComponent(screenKey)}`;
  }

  function handleTvScreenChange(screenKey, patch) {
    commit(previous => updateTvScreen(previous, screenKey, patch));
  }

  function handleAnnouncementDraftChange(screenKey, value) {
    setAnnouncementDrafts(previous => ({ ...previous, [screenKey]: value }));
  }

  function publishAnnouncement(screenKey) {
    const draft = String(announcementDrafts[screenKey] || '').trim();
    handleTvScreenChange(screenKey, { announcement: draft });
    setAnnouncementDrafts(previous => ({ ...previous, [screenKey]: draft }));
  }

  function clearAnnouncement(screenKey) {
    setAnnouncementDrafts(previous => ({ ...previous, [screenKey]: '' }));
    handleTvScreenChange(screenKey, { announcement: '' });
  }

  function toggleHeroVisibility() {
    setHeroHidden(previous => {
      const next = !previous;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HERO_VISIBILITY_STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }

  function toggleTvControlVisibility() {
    setTvControlHidden(previous => {
      const next = !previous;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TV_CONTROL_VISIBILITY_STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }

  const visibleEntries = standings.filter(entry => entry.name.toLowerCase().includes(search.toLowerCase()));
  const tournamentTitle = state.tournamentName || form.tournamentName || 'Klubmesterskab 2025';

  return (
    <main className="sd-page">
      <header className="sd-topbar">
        <div className="sd-brand">
          <div className="sd-logo-mark" />
          <div>
            <div className="sd-brand-title">Showdart</div>
            <div className="sd-brand-subtitle">{t.brandSub}</div>
          </div>
        </div>
        <nav className="sd-nav">
          {navButton('tournament', t.tournament, Trophy, () => {})}
          {navButton('championship', t.championship, Medal, onOpenChampionship)}
          {navButton('game', t.game, Gamepad2, onOpenGame)}
          {role === 'admin' ? navButton('admin', t.admin, UsersRound, onOpenAdmin) : null}
          {navButton('rules', t.rules, ShieldCheck, () => setRulesOpen(true))}
        </nav>
        <div className="sd-userbar">
          <span>{email} ({role})</span>
          <button type="button" aria-label="Dansk" className={`sd-flag ${lang === 'da' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/dk.png')" }} onClick={() => onLanguageChange('da')} />
          <button type="button" aria-label="English" className={`sd-flag ${lang === 'en' ? 'is-active' : ''}`} style={{ backgroundImage: "url('https://flagcdn.com/w40/gb.png')" }} onClick={() => onLanguageChange('en')} />
          <button type="button" className="sd-logout" onClick={onLogout}>{t.logout}</button>
        </div>
      </header>

      {!heroHidden ? <section className="sd-hero">
        <div className="sd-hero-inner">
          <div className="sd-card sd-hero-card">
            <h1 className="sd-title">{tournamentTitle}</h1>
            <div className="sd-meta-row">
              <span><UsersRound size={16} /> {entries.length} {lang === 'da' ? 'deltagere' : 'participants'}</span>
              <span>{state.teammateMode === 'fixed' ? t.fixed : t.changing}</span>
              <span><RefreshCw size={16} /> {state.maxLosses} {t.losses}</span>
              <span><CalendarDays size={16} /> {new Date().toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-US')}</span>
            </div>
          </div>
          <div className="sd-card sd-spectator-card">
            <div className="sd-small-label">{t.spectator}</div>
            <div className="sd-live"><span className="sd-dot" /> {screenInfo?.screenUrl ? t.liveActive : '...'}</div>
            {screenNotice || screenError ? <div className="sd-small-label" style={{ marginTop: 8 }}>{screenNotice || screenError}</div> : null}
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {screenInfo?.screenUrl && !state.started ? (
                <div className="sd-qr-box">
                  <QrCode size={16} />
                  <img alt="QR kode til publikumsskærm" src={`https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=${encodeURIComponent(screenInfo.screenUrl)}`} />
                </div>
              ) : null}
              <button type="button" className="sd-button gold full" disabled={!screenInfo?.screenUrl} onClick={() => screenInfo?.screenUrl && window.open(screenInfo.screenUrl, '_blank', 'noopener,noreferrer')}>
                {t.openSpectator} <ExternalLink size={15} />
              </button>
                <button type="button" className="sd-button full" disabled={!isRoundActive || tournamentFinished || !state.roundPublished} onClick={() => commit(previous => showStandingsOverride(previous))}>
                {t.showStandings} <Eye size={15} />
              </button>
            </div>
          </div>
        </div>
      </section> : null}

      {!tvControlHidden ? <section className="sd-tv-control">
        <div className="sd-card sd-panel">
          <h2 className="sd-panel-title">{t.tvControl}</h2>
          <div className="sd-tv-grid">
            {['screen1', 'screen2'].map(screenKey => {
              const config = state.tvScreens?.[screenKey] || {};
              const announcementDraft = announcementDrafts[screenKey] ?? config.announcement ?? '';
              const liveAnnouncement = config.announcement || '';
              const url = getScreenUrl(screenKey);
              return (
                <div className="sd-tv-card" key={screenKey}>
                  <div className="sd-tv-head">
                    <strong>{screenKey === 'screen1' ? t.screenOne : t.screenTwo}</strong>
                    <span>{config.label}</span>
                  </div>
                  <div className="sd-tv-controls">
                    <Field label={t.tvMode}>
                      <select className="sd-select" value={config.mode || 'auto'} onChange={event => handleTvScreenChange(screenKey, { mode: event.target.value })}>
                        <option value="auto">{t.modeAuto}</option>
                        <option value="live">{t.modeLive}</option>
                        <option value="standings">{t.modeStandings}</option>
                        <option value="info">{t.modeInfo}</option>
                        <option value="lanes">{t.modeLanes}</option>
                        <option value="rotating">{t.modeRotating}</option>
                        <option value="final">{t.modeFinal}</option>
                      </select>
                    </Field>
                    {config.mode === 'live' ? (
                      <Field label={t.tvMatchesPerPage}>
                        <input className="sd-input" type="number" min="1" max="20" value={config.matchesPerPage || 6} onChange={event => handleTvScreenChange(screenKey, { matchesPerPage: Number(event.target.value) })} />
                      </Field>
                    ) : (
                      <Field label={t.tvRows}>
                        <input className="sd-input" type="number" min="6" max="20" value={config.rowsPerPage || 12} onChange={event => handleTvScreenChange(screenKey, { rowsPerPage: Number(event.target.value) })} />
                      </Field>
                    )}
                    <Field label={t.tvRotation}>
                      <input className="sd-input" type="number" min="5" max="60" value={config.rotationSeconds || 10} onChange={event => handleTvScreenChange(screenKey, { rotationSeconds: Number(event.target.value) })} />
                    </Field>
                    <Field label={t.tvTheme}>
                      <select className="sd-select" value={config.theme || 'classic'} onChange={event => handleTvScreenChange(screenKey, { theme: event.target.value })}>
                        <option value="classic">{t.themeClassic}</option>
                        <option value="highContrast">{t.themeHighContrast}</option>
                        <option value="light">{t.themeLight}</option>
                        <option value="minimal">{t.themeMinimal}</option>
                      </select>
                    </Field>
                    <label className="sd-tv-check">
                      <input type="checkbox" checked={config.showQr !== false} onChange={event => handleTvScreenChange(screenKey, { showQr: event.target.checked })} />
                      {t.tvQr}
                    </label>
                  </div>
                  <div className="sd-tv-extra-controls">
                    <Field label={t.tvAnnouncement}>
                      <input className="sd-input" maxLength="180" value={announcementDraft} placeholder={t.tvAnnouncementPlaceholder} onChange={event => handleAnnouncementDraftChange(screenKey, event.target.value)} />
                    </Field>
                    <button type="button" className="sd-button gold full" disabled={!announcementDraft.trim() || announcementDraft.trim() === liveAnnouncement} onClick={() => publishAnnouncement(screenKey)}>
                      {t.tvPublishAnnouncement}
                    </button>
                    <button type="button" className="sd-button full" disabled={!liveAnnouncement && !announcementDraft} onClick={() => clearAnnouncement(screenKey)}>
                      {t.tvClearAnnouncement}
                    </button>
                    <label className="sd-tv-check">
                      <input type="checkbox" checked={!!config.hideHeader} onChange={event => handleTvScreenChange(screenKey, { hideHeader: event.target.checked })} />
                      {t.tvHideHeader}
                    </label>
                    <label className="sd-tv-check">
                      <input type="checkbox" checked={!!config.autoHideHeader} onChange={event => handleTvScreenChange(screenKey, { autoHideHeader: event.target.checked })} />
                      {t.tvAutoHideHeader}
                    </label>
                  </div>
                  <div className="sd-tv-lanes">
                    {Array.from({ length: state.laneCount }, (_, index) => index + 1).map(lane => {
                      const selected = Array.isArray(config.lanes) && config.lanes.includes(lane);
                      return (
                        <button
                          type="button"
                          key={lane}
                          className={`sd-tv-lane ${selected ? 'is-selected' : ''}`}
                          onClick={() => {
                            const lanes = Array.isArray(config.lanes) ? config.lanes : [];
                            handleTvScreenChange(screenKey, {
                              lanes: selected ? lanes.filter(value => value !== lane) : [...lanes, lane]
                            });
                          }}
                        >
                          Bane {lane}
                        </button>
                      );
                    })}
                  </div>
                  <div className="sd-tv-actions">
                    <button type="button" className="sd-button gold full" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
                      {t.openSpectator} <ExternalLink size={15} />
                    </button>
                    <button type="button" className="sd-button full" disabled={!url} onClick={() => onCopyScreenLink?.(url)}>
                      {t.copy}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section> : null}

      <section className="sd-dashboard">
        <div className="sd-stack">
          <Panel title={t.setup}>
            <div className="sd-form-grid">
              <Field label={t.tournamentName}><input className="sd-input" value={form.tournamentName} onChange={event => handleSetupChange({ tournamentName: event.target.value })} /></Field>
              <Field label={t.format}>
                <select className="sd-select" value={form.teammateMode} disabled={state.started} onChange={event => handleTournamentFormatChange(event.target.value)}>
                  <option value="changing">{t.changing}</option>
                  <option value="fixed">{t.fixed}</option>
                </select>
              </Field>
              <Field label={t.losses}>
                <div style={{ display: 'grid', gridTemplateColumns: state.started ? 'minmax(0, 1fr) auto' : '1fr', gap: 6 }}>
                  <input className="sd-input" type="number" min="1" max="20" value={form.maxLosses} disabled={state.started && !canManageEntries} onChange={event => handleSetupChange({ maxLosses: Number(event.target.value) })} />
                  {state.started && Number(form.maxLosses) !== state.maxLosses ? (
                    <button type="button" className="sd-button gold" title={t.saveLossLimit} onClick={handleSaveMaxLosses}><Check size={15} /> {t.save}</button>
                  ) : null}
                </div>
              </Field>
              <Field label={t.lanesCount}><input className="sd-input" type="number" min="1" max="32" value={form.laneCount} disabled={state.started} onChange={event => handleSetupChange({ laneCount: Number(event.target.value) })} /></Field>
              <Field label={t.status}><span className="sd-green-text">{state.started ? t.started : t.waiting}</span></Field>
              {!state.started ? <button type="button" className="sd-button gold full" onClick={handleStart}>{t.start}</button> : null}
            </div>
          </Panel>
          <Panel title={t.quick}>
            <div className="sd-stack">
              <form onSubmit={handleAddEntry} className="sd-stack">
                {registrationMode === 'fixed' ? (
                  <>
                    <input className="sd-input" placeholder={t.memberOne} value={memberOne} disabled={!canAddEntries} onChange={event => setMemberOne(event.target.value)} />
                    <input className="sd-input" placeholder={t.memberTwo} value={memberTwo} disabled={!canAddEntries} onChange={event => setMemberTwo(event.target.value)} />
                  </>
                ) : (
                  <input className="sd-input" placeholder={t.playerName} value={playerName} disabled={!canAddEntries} onChange={event => setPlayerName(event.target.value)} />
                )}
                <button type="submit" className="sd-button gold full" disabled={!canAddEntries}><Plus size={17} /> {t.addParticipant}</button>
              </form>
              <input ref={importInputRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
              <button type="button" className="sd-button full" disabled={!canAddEntries} onClick={() => importInputRef.current?.click()}><Upload size={17} /> {t.importParticipants}</button>
              <button type="button" className="sd-button full" onClick={toggleHeroVisibility}>{heroHidden ? <Eye size={17} /> : <EyeOff size={17} />} {heroHidden ? t.showWorkspaceHeader : t.hideWorkspaceHeader}</button>
              <button type="button" className="sd-button full" onClick={toggleTvControlVisibility}>{tvControlHidden ? <Eye size={17} /> : <EyeOff size={17} />} {tvControlHidden ? t.showTvControl : t.hideTvControl}</button>
              <button type="button" className="sd-button full" onClick={() => setTreeVisible(value => !value)}><GitBranch size={17} /> {treeVisible ? t.hideStandingsTree : t.standingsTree}</button>
              <button type="button" className="sd-button full" disabled={!state.roundHistory?.length} onClick={() => setHistoryVisible(value => !value)}><History size={17} /> {historyVisible ? t.hideHistory : t.history}</button>
              <button type="button" className="sd-button full" onClick={handleResetTournament}><RotateCcw size={17} /> {t.reset}</button>
            </div>
          </Panel>
        </div>

        <Panel title={`${t.participants} (${entries.length})`}>
          <div className="sd-participant-tools">
            <input className="sd-input" placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} />
            <select className="sd-select" value="all" readOnly><option>{t.all}</option></select>
          </div>
          <div className="sd-table-wrap">
          <table className="sd-table">
            <thead><tr><th></th><th>{t.name}</th><th>{t.roleStatus}</th><th>{t.losses}</th><th>{t.tags}</th><th></th></tr></thead>
            <tbody>
              {visibleEntries.map((entry, index) => (
                <tr key={entry.id}>
                  <td><span className="sd-seed">{index + 1}</span></td>
                  <td>{entry.name}</td>
                  <td>{entry.active ? t.active : t.eliminated}{entry.eliminationRound ? ` R${entry.eliminationRound}` : ''}</td>
                  <td><input className="sd-input" style={{ width: 58, padding: 5 }} type="number" min="0" value={entry.losses || 0} disabled={!canEditEntries} onChange={event => commit(previous => updateEntryLosses(previous, entry.id, Number(event.target.value)))} /></td>
                  <td>
                    <div className="sd-tag-actions">
                      {(state.teammateMode === 'fixed' ? ['O'] : ['S', 'O']).map(tag => (
                        <button key={tag} type="button" className={`sd-tag tag-${tag.toLowerCase()} ${entry.tags?.includes(tag) ? 'is-on' : ''} ${entry.modifiedTags?.includes(tag) ? 'is-pending' : ''}`} disabled={!state.started || !canManageEntries} onClick={() => commit(previous => togglePlayerTag(previous, entry.id, tag))}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td><button type="button" className="sd-button" title={entry.active ? t.eliminate : t.remove} disabled={state.started && !canManageEntries} style={{ minHeight: 32, padding: 5 }} onClick={() => handleEntryAction(entry)}><MoreVertical size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>

        <Panel title={t.lanes}>
          <div className="sd-lane-list">
            {Array.from({ length: state.laneCount }, (_, index) => index + 1).map(lane => {
              const active = state.activeLanes.includes(lane);
              return (
                <button
                  type="button"
                  className={`sd-lane-toggle ${active ? 'is-active' : 'is-inactive'}`}
                  key={lane}
                  aria-pressed={active}
                  onClick={() => handleToggleLane(lane, active)}
                >
                  <span className="sd-mini-board" />
                  <span>
                    <strong>Bane {lane}</strong>
                    <small>{active ? 'Aktiv' : 'Inaktiv'}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={t.currentRound} action={!isRoundActive && state.started && !tournamentFinished ? <button type="button" className="sd-button gold" disabled={canApproveTags} onClick={handleGenerate}>{t.nextRound}</button> : null}>
          <div className="sd-match-list">
            {finalPlacements.length ? (
              <FinalResults placements={finalPlacements} t={t} />
            ) : finalRankingIds.length ? (
              <FinalRanking ids={finalRankingIds} entries={entries} t={t} onMove={moveFinalist} onConfirm={handleCompleteFinal} />
            ) : isRoundActive ? (
              <>
                <div className={`sd-round-publish ${state.roundPublished ? 'is-published' : 'is-draft'}`}>
                  <div>
                    <strong>{state.roundPublished ? t.roundLive : t.roundDraft}</strong>
                    <span>{state.matches.length} {t.matches} · {state.activeLanes.length} {t.lanes} · {state.matches.filter(match => Number(match.lanePosition) > 1).length} {t.laneQueued}</span>
                  </div>
                  {!state.roundPublished ? (
                    <button type="button" className="sd-button gold" onClick={handlePublishRound}><Eye size={16} /> {t.publishRound}</button>
                  ) : !state.matches.some(match => match.winner) ? (
                    <button type="button" className="sd-button" onClick={handleHideRound}><EyeOff size={16} /> {t.hideRound}</button>
                  ) : null}
                </div>
                {[...state.matches].sort((left, right) => (Number(left.lanePosition) || 999) - (Number(right.lanePosition) || 999) || (Number(left.laneNumber) || 999) - (Number(right.laneNumber) || 999) || left.id - right.id).map(match => (
                  <MatchCard
                    key={match.id}
                    state={state}
                    match={match}
                    t={t}
                    onWinner={winner => handleSelectWinner(match.id, winner)}
                    onLane={lane => handleAssignLane(match.id, lane)}
                    onMoveQueue={direction => handleMoveMatchQueue(match.id, direction)}
                  />
                ))}
                {skippedEntries.length ? <div className="sd-match-card"><div className="sd-match-title">{t.sitOver}</div><div>{skippedEntries.map(entry => entry.name).join(', ')}</div></div> : null}
                <button type="button" className="sd-button gold" disabled={!state.roundPublished} onClick={handleComplete}>{t.complete}</button>
              </>
            ) : (
              <>
                <div className="sd-small-label">{state.started ? t.ready : t.noMatches}</div>
                {canApproveTags ? <button type="button" className="sd-button gold" onClick={() => commit(previous => approveTagChanges(previous))}><Check size={16} /> {t.approveTags}</button> : null}
                {state.started && !tournamentFinished ? <button type="button" className="sd-button gold" disabled={canApproveTags} onClick={handleGenerate}>{t.generate}</button> : null}
                {canStartFinal ? <button type="button" className="sd-button" onClick={handleStartFinal}><Trophy size={16} /> {t.startFinal}</button> : null}
              </>
            )}
          </div>
        </Panel>
        {historyVisible ? <HistoryPanel history={state.roundHistory || []} t={t} /> : null}
        {treeVisible ? <StandingsPanel standings={standings} t={t} maxLosses={state.maxLosses} /> : null}
      </section>

      <footer className="sd-bottom">
        <BottomItem label={t.statusLabel} value={state.started ? t.started : t.waiting} green />
        <BottomItem label={t.participants} value={`${activeEntries.length} / ${entries.length}`} />
        <BottomItem label={t.current} value={`${state.currentRound || 0}`} />
        <BottomItem label={t.matchesPlayed} value={`${matchesPlayed} / ${matchesPlayed + state.matches.length}`} />
        <BottomItem label={t.lanesInUse} value={`${state.activeLanes.length} / ${state.laneCount}`} />
        <BottomItem label={t.lastUpdate} value={loaded ? new Date().toLocaleTimeString('da-DK') : '...'} />
      </footer>
      {dialog ? (
        <ShowdartDialog
          dialog={dialog}
          onCancel={closeDialog}
          onConfirm={confirmDialog}
        />
      ) : null}
      {rulesOpen ? (
        <RulesDialog
          t={t}
          mode={registrationMode}
          onClose={() => setRulesOpen(false)}
        />
      ) : null}
    </main>
  );
}

function Panel({ title, action, children }) {
  return (
    <div className="sd-card sd-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="sd-panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function ShowdartDialog({ dialog, onCancel, onConfirm }) {
  const isConfirm = dialog.kind === 'confirm';
  return (
    <div className="sd-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !isConfirm) onCancel();
    }}>
      <div className="sd-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-dialog-title">
        <div className="sd-dialog-mark">{isConfirm ? '!' : 'i'}</div>
        <div>
          <h2 id="sd-dialog-title" className="sd-dialog-title">{dialog.title}</h2>
          <p className="sd-dialog-message">{dialog.message}</p>
        </div>
        <div className="sd-dialog-actions">
          {isConfirm ? <button type="button" className="sd-button" onClick={onCancel}>{dialog.cancelLabel}</button> : null}
          <button type="button" className={`sd-button ${isConfirm ? 'gold' : 'gold'}`} autoFocus onClick={isConfirm ? onConfirm : onCancel}>
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesDialog({ t, mode, onClose }) {
  const isFixed = mode === 'fixed';
  const rules = isFixed ? t.rulesFixed : t.rulesChanging;
  return (
    <div className="sd-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="sd-dialog sd-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-rules-title">
        <div className="sd-dialog-mark">?</div>
        <div>
          <h2 id="sd-rules-title" className="sd-dialog-title">{t.rulesTitle}</h2>
          <p className="sd-dialog-message">{isFixed ? t.rulesFixedTitle : t.rulesChangingTitle}</p>
        </div>
        <ol className="sd-rules-list">
          {rules.map((rule, index) => <li key={index}>{rule}</li>)}
        </ol>
        <div className="sd-dialog-actions">
          <button type="button" className="sd-button gold" autoFocus onClick={onClose}>{t.ok}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="sd-field"><label>{label}</label>{children}</div>;
}

function MatchCard({ state, match, t, onWinner, onLane, onMoveQueue }) {
  const team1 = getMatchLabel(state, match, 1);
  const team2 = getMatchLabel(state, match, 2);
  const laneStatus = getMatchLaneStatus(state, match.id);
  const displayStatus = state.roundPublished ? laneStatus : 'draft';
  const laneQueue = Number.isInteger(match.laneNumber)
    ? state.matches.filter(item => item.laneNumber === match.laneNumber).sort((left, right) => (Number(left.lanePosition) || 999) - (Number(right.lanePosition) || 999) || left.id - right.id)
    : [];
  const queueIndex = laneQueue.findIndex(item => item.id === match.id);
  const statusLabel = displayStatus === 'draft'
    ? t.roundDraft
    : laneStatus === 'current'
    ? t.laneCurrent
    : laneStatus === 'queued'
      ? t.laneQueued
      : laneStatus === 'completed'
        ? t.laneCompleted
        : t.laneUnassigned;
  const winnerEnabled = state.roundPublished && (laneStatus === 'current' || laneStatus === 'completed');
  return (
    <div className={`sd-match-card is-${displayStatus}`}>
      <div className="sd-match-head">
        <div className="sd-match-title">{t.match} #{match.id} - Bane {match.laneNumber || '-'}{match.lanePosition ? ` · ${t.queuePosition} ${match.lanePosition}` : ''}</div>
        <span className={`sd-pill is-${displayStatus}`}>{statusLabel}</span>
      </div>
      <div className="sd-score-row">
        <div className="sd-match-side"><div className="sd-match-name">{team1}</div><div className="sd-match-sub">Seed {match.id * 2 - 1}</div></div>
        <button className={`sd-score-box ${match.winner === 1 ? 'win' : ''}`} type="button" disabled={!winnerEnabled} onClick={() => onWinner(1)}>{match.winner === 1 ? '✓' : '-'}</button>
        <div style={{ textAlign: 'center', fontWeight: 900 }}>VS</div>
        <button className={`sd-score-box ${match.winner === 2 ? 'win' : ''}`} type="button" disabled={!winnerEnabled} onClick={() => onWinner(2)}>{match.winner === 2 ? '✓' : '-'}</button>
        <div className="sd-match-side right"><div className="sd-match-name">{team2}</div><div className="sd-match-sub">Seed {match.id * 2}</div></div>
      </div>
      <div className="sd-match-queue-controls">
        <select className="sd-select" value={match.laneNumber || ''} disabled={!!match.winner} onChange={event => onLane(event.target.value ? Number(event.target.value) : null)}>
          <option value="">{t.laneUnassigned}</option>
          {state.activeLanes.map(lane => <option key={lane} value={lane}>Bane {lane}</option>)}
        </select>
        <button type="button" className="sd-button" title={t.moveQueueUp} aria-label={t.moveQueueUp} disabled={!!match.winner || queueIndex <= 0 || !!laneQueue[queueIndex - 1]?.winner} onClick={() => onMoveQueue(-1)}><ArrowUp size={15} /></button>
        <button type="button" className="sd-button" title={t.moveQueueDown} aria-label={t.moveQueueDown} disabled={!!match.winner || queueIndex < 0 || queueIndex >= laneQueue.length - 1 || !!laneQueue[queueIndex + 1]?.winner} onClick={() => onMoveQueue(1)}><ArrowDown size={15} /></button>
      </div>
    </div>
  );
}

function HistoryPanel({ history, t }) {
  return (
    <div className="sd-card sd-panel sd-wide-panel">
      <h2 className="sd-panel-title">{t.history}</h2>
      <div className="sd-history-wrap">
        <table className="sd-table sd-history-table">
          <thead><tr><th>{t.round}</th><th>{t.historyStatus}</th><th>{t.match} / {t.sitOver}</th><th>Bane</th><th>{t.winner}</th></tr></thead>
          <tbody>
            {[...history].sort((left, right) => (right.round || 0) - (left.round || 0)).flatMap(roundEntry => {
              const rows = (roundEntry.matches || []).map(match => {
                const isSingles = roundEntry.mode !== 'fixed' && isSinglesHistoryMatch(match);
                return (
                  <tr key={`${roundEntry.round}-${match.id}`}>
                    <td>{t.round} {roundEntry.round}</td>
                    <td><span className={`sd-history-badge ${isSingles ? 'is-singles' : 'is-playing'}`}>{isSingles ? t.historySingles : t.historyPlaying}</span></td>
                    <td>{t.match} #{match.id}: {match.team1Label} VS {match.team2Label}</td>
                    <td>{Number.isInteger(match.laneNumber) && match.laneNumber > 0 ? `Bane ${match.laneNumber}${Number.isInteger(match.lanePosition) ? ` · ${t.queuePosition} ${match.lanePosition}` : ''}` : '-'}</td>
                    <td>{match.winnerLabel || '-'}</td>
                  </tr>
                );
              });
              if (roundEntry.sitOuts?.length) {
                rows.push(
                  <tr key={`${roundEntry.round}-sit`}>
                    <td>{t.round} {roundEntry.round}</td>
                    <td><span className="sd-history-badge is-sitout">{t.sitOver}</span></td>
                    <td>{roundEntry.sitOuts.join(', ')}</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isSinglesHistoryMatch(match) {
  const left = String(match.team1Label || '').split(',').map(item => item.trim()).filter(Boolean);
  const right = String(match.team2Label || '').split(',').map(item => item.trim()).filter(Boolean);
  return left.length === 1 && right.length === 1;
}

function StandingsPanel({ standings, t, maxLosses }) {
  return (
    <div className="sd-card sd-panel sd-wide-panel">
      <h2 className="sd-panel-title">{t.standingsTree}</h2>
      <div className="sd-standings-grid">
        {standings.map((entry, index) => (
          <div className={`sd-standing-card ${entry.active === false ? 'is-out' : ''}`} key={entry.id}>
            <span className="sd-seed">{index + 1}</span>
            <div className="sd-standing-main">
              <strong>{entry.name}</strong>
              <span>{entry.losses || 0}/{maxLosses} {t.losses}</span>
            </div>
            <span className={`sd-standing-status ${entry.active === false ? 'is-out' : 'is-active'}`}>
              {entry.active === false ? `${t.eliminated}${entry.eliminationRound ? ` R${entry.eliminationRound}` : ''}` : t.active}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalRanking({ ids, entries, t, onMove, onConfirm }) {
  return (
    <div className="sd-match-card">
      <div className="sd-match-title">{t.finalRanking}</div>
      <div className="sd-final-list">
        {ids.map((id, index) => {
          const entry = entries.find(item => item.id === id);
          return (
            <div className="sd-final-row" key={id}>
              <span className="sd-seed">{index + 1}</span>
              <strong>{entry?.name || id}</strong>
              <button type="button" className="sd-button" disabled={index === 0} onClick={() => onMove(id, -1)}><ArrowUp size={14} /></button>
              <button type="button" className="sd-button" disabled={index === ids.length - 1} onClick={() => onMove(id, 1)}><ArrowDown size={14} /></button>
            </div>
          );
        })}
      </div>
      <button type="button" className="sd-button gold full" onClick={onConfirm}>{t.confirmFinal}</button>
    </div>
  );
}

function FinalResults({ placements, t }) {
  return (
    <div className="sd-match-card">
      <div className="sd-match-title">{t.finalResults}</div>
      <div className="sd-final-list">
        {placements.map(entry => (
          <div className="sd-final-row" key={`${entry.place}-${entry.id}`}>
            <span className="sd-seed">{entry.place}</span>
            <strong>{entry.name}</strong>
            <span>{entry.active === false ? t.eliminated : t.winner}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomItem({ label, value, green }) {
  return <div className="sd-bottom-item"><div className="sd-bottom-label">{label}</div><div className={`sd-bottom-value ${green ? 'sd-green-text' : ''}`}>{value}</div></div>;
}

function buildFinalPlacements(entries, state) {
  const finalIds = state.teammateMode === 'fixed' ? state.finalResultTeamIds : state.finalResultPlayerIds;
  const storedResults = Array.isArray(state.finalResults) ? state.finalResults : [];
  const orderedIds = storedResults.length ? storedResults.map(entry => entry.id) : finalIds || [];
  if (!orderedIds.length) return [];
  const finalistIds = new Set(orderedIds);
  const placements = orderedIds.map((id, index) => {
    const entry = entries.find(item => item.id === id);
    const stored = storedResults.find(result => result.id === id);
    return entry ? { ...entry, name: stored?.name || entry.name, place: Number.isFinite(Number(stored?.place)) ? Number(stored.place) : index + 1 } : null;
  }).filter(Boolean);
  const eliminatedGroups = new Map();
  entries.filter(entry => !finalistIds.has(entry.id)).forEach(entry => {
    const key = entry.eliminationRound ?? 'unknown';
    const group = eliminatedGroups.get(key) || [];
    group.push(entry);
    eliminatedGroups.set(key, group);
  });
  let nextPlace = placements.length + 1;
  [...eliminatedGroups.entries()]
    .sort(([left], [right]) => eliminationValue(right) - eliminationValue(left))
    .forEach(([, group]) => {
      group.sort((left, right) => left.id - right.id).forEach(entry => placements.push({ ...entry, place: nextPlace }));
      nextPlace += group.length;
    });
  return placements;
}

function eliminationValue(value) {
  if (value === 'final') return Number.MAX_SAFE_INTEGER;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}


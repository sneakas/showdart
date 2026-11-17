export const MAX_REGISTRATION_NAME_LENGTH = 80;

export function cleanRegistrationName(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function isRegistrationName(name) {
  return typeof name === 'string' && name.length <= MAX_REGISTRATION_NAME_LENGTH && /[\p{L}\p{N}]/u.test(name)
    && !/[\p{Cc}\p{Cf}]/u.test(name);
}

export function isRegistrationId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export const registrationCopy = {
  da: {
    title: 'Spillertilmelding', name: 'Dit navn', next: 'Fortsæt',
    confirmTitle: 'Er dit navn stavet rigtigt?', edit: 'Ret navn', confirm: 'Bekræft tilmelding',
    success: 'Du er tilmeldt!', nextPlayer: 'Næste spiller', fullscreen: 'Fuld skærm',
    exitFullscreen: 'Afslut fuld skærm', fullscreenHelp: 'Brug browserens fuldskærmsvisning, eller føj siden til hjemmeskærmen.',
    duplicate: 'Navnet er allerede tilmeldt. Skriv dit kaldenavn, dine initialer eller dit fulde navn.',
    invalid_name: 'Skriv et navn på højst 80 tegn.', closed: 'Tilmeldingen er lukket.',
    unavailable: 'Der er ingen aktiv tilmelding til denne turnering.', missing: 'Tilmeldingen findes ikke.',
    changed: 'Listen eller turneringen blev ændret. Opdatér listen, og prøv igen.',
    failed: 'Kunne ikke oprette forbindelse. Prøv igen.', retry: 'Prøv igen', loading: 'Indlæser tilmeldingen…',
    open: 'Åbn tilmelding', tablet: 'Åbn tabletside', copy: 'Kopiér link', copied: 'Link kopieret',
    refresh: 'Opdatér liste', transfer: 'Luk tilmelding og overfør spillere', transferred: 'Tilmeldingen er lukket, og spillerne er overført.',
    empty: 'Ingen tilmeldinger endnu.', save: 'Gem', cancel: 'Annullér', remove: 'Fjern',
    removePrompt: 'Fjern {name} fra tilmeldingslisten?',
    transferPrompt: 'Luk tilmeldingen på tabletten og overfør listen til turneringen?',
    blocked: 'Luk tilmeldingen og overfør spillerne, før du starter eller ændrer turneringsformatet.',
    working: 'Gemmer…'
  },
  en: {
    title: 'Player registration', name: 'Your name', next: 'Continue',
    confirmTitle: 'Is your name spelled correctly?', edit: 'Edit name', confirm: 'Confirm registration',
    success: 'You’re registered!', nextPlayer: 'Next player', fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen', fullscreenHelp: 'Use your browser’s full-screen mode or add this page to your home screen.',
    duplicate: 'That name is already registered. Enter your nickname, initials, or full name.',
    invalid_name: 'Enter a name of up to 80 characters.', closed: 'Registration is closed.',
    unavailable: 'There is no active registration for this tournament.', missing: 'Registration was not found.',
    changed: 'The list or tournament changed. Refresh the list and try again.',
    failed: 'Could not connect. Try again.', retry: 'Try again', loading: 'Loading registration…',
    open: 'Open registration', tablet: 'Open tablet page', copy: 'Copy link', copied: 'Link copied',
    refresh: 'Refresh list', transfer: 'Close registration and import players', transferred: 'Registration is closed and the players have been imported.',
    empty: 'No registrations yet.', save: 'Save', cancel: 'Cancel', remove: 'Remove',
    removePrompt: 'Remove {name} from the registration list?',
    transferPrompt: 'Close tablet registration and import the list into the tournament?',
    blocked: 'Close registration and import the players before starting or changing the tournament format.',
    working: 'Saving…'
  }
};

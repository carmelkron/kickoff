import type { Lobby, Player } from '../types';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type RegisterDraft = {
  name: string;
  email: string;
  password: string;
  confirm?: string;
  position?: string;
  bio?: string;
  photoFile?: File | null;
};

export type CreateLobbyDraft = {
  title: string;
  address: string;
  city: string;
  date: string;
  time: string;
  numTeams: number;
  playersPerTeam: number;
  minRating?: number;
  price?: number;
  description?: string;
};

export type CreateLobbyPayload = {
  title: string;
  address: string;
  city: string;
  datetime: string;
  numTeams: number;
  playersPerTeam: number;
  minRating?: number;
  price?: number;
  description?: string;
};

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRegisterDraft(input: RegisterDraft) {
  const errors: string[] = [];
  const name = normalizeText(input.name);
  const email = input.email.trim().toLowerCase();
  const bio = input.bio ? normalizeText(input.bio) : '';

  if (name.length < 2 || name.length > 80) {
    errors.push('Name must be between 2 and 80 characters.');
  }

  if (!isValidEmail(email)) {
    errors.push('Enter a valid email address.');
  }

  if (input.password.length < 6 || input.password.length > 72) {
    errors.push('Password must be between 6 and 72 characters.');
  }

  if (typeof input.confirm === 'string' && input.password !== input.confirm) {
    errors.push('Passwords do not match.');
  }

  if (!input.position || normalizeText(input.position).length === 0) {
    errors.push('Choose your preferred position.');
  }

  if (bio.length > 280) {
    errors.push('Bio must be 280 characters or fewer.');
  }

  if (input.photoFile) {
    if (!ALLOWED_AVATAR_TYPES.has(input.photoFile.type)) {
      errors.push('Profile photo must be a JPG, PNG, or WebP image.');
    }

    if (input.photoFile.size > MAX_AVATAR_BYTES) {
      errors.push('Profile photo must be 2 MB or smaller.');
    }
  }

  return errors;
}

export function buildLobbyDateTime(date: string, time: string) {
  const candidate = new Date(`${date}T${time}`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

export function validateCreateLobbyDraft(input: CreateLobbyDraft, now = new Date()) {
  const errors: string[] = [];
  const title = normalizeText(input.title);
  const address = normalizeText(input.address);
  const city = normalizeText(input.city);
  const description = input.description ? normalizeText(input.description) : '';
  const datetime = buildLobbyDateTime(input.date, input.time);
  const maxPlayers = input.numTeams * input.playersPerTeam;

  if (title.length < 3 || title.length > 80) {
    errors.push('Game name must be between 3 and 80 characters.');
  }

  if (address.length < 2 || address.length > 160) {
    errors.push('Address must be between 2 and 160 characters.');
  }

  if (city.length < 2 || city.length > 60) {
    errors.push('City must be between 2 and 60 characters.');
  }

  if (!datetime) {
    errors.push('Choose a valid date and time.');
  } else if (datetime.getTime() <= now.getTime()) {
    errors.push('Game time must be in the future.');
  }

  if (!Number.isInteger(input.numTeams) || input.numTeams < 2 || input.numTeams > 4) {
    errors.push('Number of teams must be between 2 and 4.');
  }

  if (!Number.isInteger(input.playersPerTeam) || input.playersPerTeam < 3 || input.playersPerTeam > 11) {
    errors.push('Players per team must be between 3 and 11.');
  }

  if (maxPlayers < 6 || maxPlayers > 44) {
    errors.push('Total max players must be between 6 and 44.');
  }

  if (typeof input.price === 'number' && (!Number.isFinite(input.price) || input.price < 0 || input.price > 999)) {
    errors.push('Price must be between 0 and 999.');
  }

  if (description.length > 500) {
    errors.push('Description must be 500 characters or fewer.');
  }

  return errors;
}

export function validateCreateLobbyPayload(input: CreateLobbyPayload, now = new Date()) {
  const errors: string[] = [];
  const title = normalizeText(input.title);
  const address = normalizeText(input.address);
  const city = normalizeText(input.city);
  const description = input.description ? normalizeText(input.description) : '';
  const datetime = new Date(input.datetime);
  const maxPlayers = input.numTeams * input.playersPerTeam;

  if (title.length < 3 || title.length > 80) {
    errors.push('Game name must be between 3 and 80 characters.');
  }

  if (address.length < 2 || address.length > 160) {
    errors.push('Address must be between 2 and 160 characters.');
  }

  if (city.length < 2 || city.length > 60) {
    errors.push('City must be between 2 and 60 characters.');
  }

  if (Number.isNaN(datetime.getTime())) {
    errors.push('Choose a valid date and time.');
  } else if (datetime.getTime() <= now.getTime()) {
    errors.push('Game time must be in the future.');
  }

  if (!Number.isInteger(input.numTeams) || input.numTeams < 2 || input.numTeams > 4) {
    errors.push('Number of teams must be between 2 and 4.');
  }

  if (!Number.isInteger(input.playersPerTeam) || input.playersPerTeam < 3 || input.playersPerTeam > 11) {
    errors.push('Players per team must be between 3 and 11.');
  }

  if (maxPlayers < 6 || maxPlayers > 44) {
    errors.push('Total max players must be between 6 and 44.');
  }

  if (typeof input.price === 'number' && (!Number.isFinite(input.price) || input.price < 0 || input.price > 999)) {
    errors.push('Price must be between 0 and 999.');
  }

  if (description.length > 500) {
    errors.push('Description must be 500 characters or fewer.');
  }

  return errors;
}

export function getJoinLobbyError(
  lobby: Lobby,
  player: Player | null,
  options?: { allowExistingWaitlist?: boolean },
) {
  if (!player) {
    return 'Please log in to join this game.';
  }

  if (lobby.players.some((member) => member.id === player.id)) {
    return 'You are already in this game.';
  }

  if (!options?.allowExistingWaitlist && lobby.waitlist.some((member) => member.id === player.id)) {
    return 'You are already on the waitlist.';
  }

  return null;
}

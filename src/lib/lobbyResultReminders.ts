import type { GameType } from '../types';

export const LOBBY_RESULT_REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;
const RESULT_REMINDER_DISMISSED_SESSION_KEY = 'kickoff_result_reminder_dismissed_lobbies';

export interface LobbyResultReminderCandidate {
  lobbyId: string;
  lobbyTitle: string;
  lobbyDatetime: string;
  gameType: GameType;
  isManagedByViewer: boolean;
  hasResult: boolean;
  teamCount: number;
}

export interface PendingLobbyResultReminder {
  lobbyId: string;
  lobbyTitle: string;
  lobbyDatetime: string;
  remindAt: string;
}

function getLobbyTimestamp(lobbyDatetime: string) {
  return new Date(lobbyDatetime).getTime();
}

export function getLobbyResultReminderTime(
  lobbyDatetime: string,
  delayMs = LOBBY_RESULT_REMINDER_DELAY_MS,
) {
  return new Date(getLobbyTimestamp(lobbyDatetime) + delayMs);
}

export function canSubmitLobbyResult(
  lobbyDatetime: string,
  now = new Date(),
  delayMs = LOBBY_RESULT_REMINDER_DELAY_MS,
) {
  const lobbyTimestamp = getLobbyTimestamp(lobbyDatetime);
  if (Number.isNaN(lobbyTimestamp)) {
    return false;
  }

  return now.getTime() >= lobbyTimestamp + delayMs;
}

export function buildPendingLobbyResultReminders(
  candidates: LobbyResultReminderCandidate[],
  now = new Date(),
  delayMs = LOBBY_RESULT_REMINDER_DELAY_MS,
): PendingLobbyResultReminder[] {
  return candidates
    .filter((candidate) =>
      candidate.gameType === 'competitive'
      && candidate.isManagedByViewer
      && !candidate.hasResult
      && candidate.teamCount >= 2
      && canSubmitLobbyResult(candidate.lobbyDatetime, now, delayMs),
    )
    .map((candidate) => ({
      lobbyId: candidate.lobbyId,
      lobbyTitle: candidate.lobbyTitle,
      lobbyDatetime: candidate.lobbyDatetime,
      remindAt: getLobbyResultReminderTime(candidate.lobbyDatetime, delayMs).toISOString(),
    }))
    .sort((left, right) => left.remindAt.localeCompare(right.remindAt));
}

function loadDismissedReminderIds() {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = window.sessionStorage.getItem(RESULT_REMINDER_DISMISSED_SESSION_KEY);
    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
}

function saveDismissedReminderIds(reminderIds: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    RESULT_REMINDER_DISMISSED_SESSION_KEY,
    JSON.stringify([...reminderIds]),
  );
}

export function isLobbyResultReminderDismissedForSession(lobbyId: string) {
  return loadDismissedReminderIds().has(lobbyId);
}

export function dismissLobbyResultReminderForSession(lobbyId: string) {
  const reminderIds = loadDismissedReminderIds();
  reminderIds.add(lobbyId);
  saveDismissedReminderIds(reminderIds);
}

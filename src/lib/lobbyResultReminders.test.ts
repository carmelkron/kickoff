import { describe, expect, it } from 'vitest';
import {
  LOBBY_RESULT_REMINDER_DELAY_MS,
  buildPendingLobbyResultReminders,
  canSubmitLobbyResult,
  dismissLobbyResultReminderForSession,
  getLobbyResultReminderTime,
  isLobbyResultReminderDismissedForSession,
} from './lobbyResultReminders';

describe('lobbyResultReminders', () => {
  it('waits for the grace period before allowing result submission', () => {
    const lobbyDatetime = '2026-04-17T10:00:00.000Z';

    expect(
      canSubmitLobbyResult(
        lobbyDatetime,
        new Date('2026-04-17T11:59:59.000Z'),
        LOBBY_RESULT_REMINDER_DELAY_MS,
      ),
    ).toBe(false);

    expect(
      canSubmitLobbyResult(
        lobbyDatetime,
        new Date('2026-04-17T12:00:00.000Z'),
        LOBBY_RESULT_REMINDER_DELAY_MS,
      ),
    ).toBe(true);
  });

  it('returns false for invalid lobby datetimes', () => {
    expect(canSubmitLobbyResult('not-a-real-date')).toBe(false);
  });

  it('returns only due competitive lobbies that still need results', () => {
    const reminders = buildPendingLobbyResultReminders(
      [
        {
          lobbyId: 'due-managed',
          lobbyTitle: 'Friday Match',
          lobbyDatetime: '2026-04-17T08:00:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 2,
        },
        {
          lobbyId: 'too-early',
          lobbyTitle: 'Still Playing',
          lobbyDatetime: '2026-04-17T10:30:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 2,
        },
        {
          lobbyId: 'already-reported',
          lobbyTitle: 'Reported',
          lobbyDatetime: '2026-04-17T07:00:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: true,
          teamCount: 2,
        },
        {
          lobbyId: 'friendly',
          lobbyTitle: 'Friendly Kickabout',
          lobbyDatetime: '2026-04-17T07:00:00.000Z',
          gameType: 'friendly',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 2,
        },
        {
          lobbyId: 'no-teams',
          lobbyTitle: 'No Teams Yet',
          lobbyDatetime: '2026-04-17T07:00:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 1,
        },
        {
          lobbyId: 'not-managed',
          lobbyTitle: 'Someone Else Organizes',
          lobbyDatetime: '2026-04-17T07:00:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: false,
          hasResult: false,
          teamCount: 2,
        },
      ],
      new Date('2026-04-17T12:00:00.000Z'),
    );

    expect(reminders).toEqual([
      {
        lobbyId: 'due-managed',
        lobbyTitle: 'Friday Match',
        lobbyDatetime: '2026-04-17T08:00:00.000Z',
        remindAt: '2026-04-17T10:00:00.000Z',
      },
    ]);
  });

  it('sorts reminders so the oldest overdue lobby appears first', () => {
    const reminders = buildPendingLobbyResultReminders(
      [
        {
          lobbyId: 'later',
          lobbyTitle: 'Later Reminder',
          lobbyDatetime: '2026-04-17T09:30:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 2,
        },
        {
          lobbyId: 'earlier',
          lobbyTitle: 'Earlier Reminder',
          lobbyDatetime: '2026-04-17T07:30:00.000Z',
          gameType: 'competitive',
          isManagedByViewer: true,
          hasResult: false,
          teamCount: 2,
        },
      ],
      new Date('2026-04-17T12:00:00.000Z'),
    );

    expect(reminders.map((reminder) => reminder.lobbyId)).toEqual(['earlier', 'later']);
  });

  it('computes reminder time and stores dismissed reminders in session', () => {
    expect(getLobbyResultReminderTime('2026-04-17T10:00:00.000Z').toISOString()).toBe('2026-04-17T12:00:00.000Z');
    expect(isLobbyResultReminderDismissedForSession('lobby-1')).toBe(false);

    dismissLobbyResultReminderForSession('lobby-1');

    expect(isLobbyResultReminderDismissedForSession('lobby-1')).toBe(true);
  });

  it('ignores malformed dismissed-reminder session data', () => {
    window.sessionStorage.setItem('kickoff_result_reminder_dismissed_lobbies', '{"bad":true}');

    expect(isLobbyResultReminderDismissedForSession('lobby-1')).toBe(false);
  });
});

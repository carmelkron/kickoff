import { describe, expect, it } from 'vitest';
import {
  LOBBY_RESULT_REMINDER_DELAY_MS,
  buildPendingLobbyResultReminders,
  canSubmitLobbyResult,
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
});

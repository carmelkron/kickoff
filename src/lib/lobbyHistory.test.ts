import { describe, expect, it } from 'vitest';
import { buildLobbyHistoryEntries } from './lobbyHistory';

describe('buildLobbyHistoryEntries', () => {
  it('returns only past joined lobbies in reverse chronological order', () => {
    const history = buildLobbyHistoryEntries(
      [
        { lobby_id: 'past-a', status: 'joined' },
        { lobby_id: 'future-a', status: 'joined' },
        { lobby_id: 'waitlisted-a', status: 'waitlisted' },
        { lobby_id: 'deleted-a', status: 'joined' },
        { lobby_id: 'past-b', status: 'joined' },
      ],
      [
        { id: 'future-a', title: 'Future Game', city: 'Haifa', datetime: '2026-04-20T18:00:00.000Z', status: 'active' },
        { id: 'past-a', title: 'Past Game A', city: 'Tel Aviv', datetime: '2026-04-10T18:00:00.000Z', status: 'active' },
        { id: 'waitlisted-a', title: 'Waitlist Only', city: 'Jerusalem', datetime: '2026-04-09T18:00:00.000Z', status: 'active' },
        { id: 'deleted-a', title: 'Deleted Game', city: 'Ramat Gan', datetime: '2026-04-08T18:00:00.000Z', status: 'deleted' },
        { id: 'past-b', title: 'Past Game B', city: 'Beer Sheva', datetime: '2026-04-12T18:00:00.000Z', status: 'expired' },
      ],
      new Date('2026-04-17T12:00:00.000Z'),
    );

    expect(history).toEqual([
      {
        lobbyId: 'past-b',
        lobbyTitle: 'Past Game B',
        date: '2026-04-12T18:00:00.000Z',
        city: 'Beer Sheva',
        gameType: 'friendly',
        ratingChange: 0,
      },
      {
        lobbyId: 'past-a',
        lobbyTitle: 'Past Game A',
        date: '2026-04-10T18:00:00.000Z',
        city: 'Tel Aviv',
        gameType: 'friendly',
        ratingChange: 0,
      },
    ]);
  });

  it('treats missing status as a normal lobby when it is already in the past', () => {
    const history = buildLobbyHistoryEntries(
      [{ lobby_id: 'legacy-lobby', status: 'joined' }],
      [{ id: 'legacy-lobby', title: 'Legacy Game', city: 'Netanya', datetime: '2026-04-01T18:00:00.000Z' }],
      new Date('2026-04-17T12:00:00.000Z'),
    );

    expect(history).toEqual([
      {
        lobbyId: 'legacy-lobby',
        lobbyTitle: 'Legacy Game',
        date: '2026-04-01T18:00:00.000Z',
        city: 'Netanya',
        gameType: 'friendly',
        ratingChange: 0,
      },
    ]);
  });
});

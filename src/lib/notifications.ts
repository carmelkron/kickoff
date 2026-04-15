import type { AuthUser, Lobby } from '../types';

export type AppNotification = {
  id: string;
  kind: 'friend_request' | 'friend_joined_lobby' | 'organizer_summary';
  title: string;
  message: string;
  lobbyId?: string;
  profileId?: string;
  requesterId?: string;
  priority: number;
};

type BuildNotificationsInput = {
  allUsers: AuthUser[];
  currentUser: AuthUser;
  lang: 'he' | 'en';
  lobbies: Lobby[];
};

export function buildNotifications({ allUsers, currentUser, lang, lobbies }: BuildNotificationsInput): AppNotification[] {
  const isHebrew = lang === 'he';
  const activeLobbies = lobbies.filter((lobby) => lobby.status === 'active');
  const userById = new Map(allUsers.map((user) => [user.id, user]));
  const notifications: AppNotification[] = [];

  for (const requesterId of currentUser.pendingRequests) {
    const requester = userById.get(requesterId);
    notifications.push({
      id: `friend-request:${requesterId}`,
      kind: 'friend_request',
      title: isHebrew ? 'בקשת חברות חדשה' : 'New friend request',
      message: requester
        ? (isHebrew ? `${requester.name} שלח לך בקשת חברות.` : `${requester.name} sent you a friend request.`)
        : (isHebrew ? 'קיבלת בקשת חברות חדשה.' : 'You received a new friend request.'),
      profileId: requesterId,
      requesterId,
      priority: 300,
    });
  }

  for (const lobby of activeLobbies) {
    const joinedFriends = lobby.players.filter((player) => currentUser.friends.includes(player.id) && player.id !== currentUser.id);
    if (joinedFriends.length === 0) {
      continue;
    }

    const ids = joinedFriends.map((friend) => friend.id).sort().join(',');
    const [firstFriend, ...otherFriends] = joinedFriends;
    notifications.push({
      id: `friend-lobby:${lobby.id}:${ids}`,
      kind: 'friend_joined_lobby',
      title: isHebrew ? 'חברים שלך הצטרפו ללובי' : 'Your friends joined a lobby',
      message: otherFriends.length > 0
        ? (isHebrew
            ? `${firstFriend.name} ועוד ${otherFriends.length} חברים נמצאים ב-${lobby.title}.`
            : `${firstFriend.name} and ${otherFriends.length} more friends are in ${lobby.title}.`)
        : (isHebrew
            ? `${firstFriend.name} נמצא ב-${lobby.title}.`
            : `${firstFriend.name} is in ${lobby.title}.`),
      lobbyId: lobby.id,
      priority: 200,
    });
  }

  for (const lobby of activeLobbies.filter((item) => item.createdBy === currentUser.id)) {
    notifications.push({
      id: `organizer-summary:${lobby.id}:${lobby.players.length}:${lobby.waitlist.length}`,
      kind: 'organizer_summary',
      title: isHebrew ? 'עדכון ללובי שלך' : 'Update for your lobby',
      message: isHebrew
        ? `${lobby.title}: ${lobby.players.length}/${lobby.maxPlayers} שחקנים${lobby.waitlist.length > 0 ? `, ${lobby.waitlist.length} בהמתנה` : ''}.`
        : `${lobby.title}: ${lobby.players.length}/${lobby.maxPlayers} players${lobby.waitlist.length > 0 ? `, ${lobby.waitlist.length} waiting` : ''}.`,
      lobbyId: lobby.id,
      priority: 100,
    });
  }

  return notifications.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

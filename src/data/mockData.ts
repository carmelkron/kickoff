import { Player, Lobby } from '../types';

// Today = 2026-04-05. Positive offsets = future games (visible). Negative = past (filtered out).
const D = (offsetDays: number, hour: number, min = 0) => {
  const d = new Date('2026-04-05T00:00:00');
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

export const mockPlayers: Player[] = [
  {
    id: 'p1', name: 'אבי כהן', initials: 'אכ', avatarColor: 'bg-blue-500',
    rating: 7.8, gamesPlayed: 48, position: 'חלוץ',
    bio: 'שחקן כדורגל נלהב מתל אביב. אוהב לשחק בקצב גבוה.',
    ratingHistory: [
      { date: '2026-04-03', rating: 7.8, change: 0.3, lobbyTitle: 'משחק ערב בגורדון', lobbyId: 'l1' },
      { date: '2026-03-28', rating: 7.5, change: 0.2, lobbyTitle: 'אליפות השכונה', lobbyId: 'l6' },
      { date: '2026-03-15', rating: 7.3, change: -0.1, lobbyTitle: 'משחק בוקר', lobbyId: 'l3' },
      { date: '2026-03-01', rating: 7.4, change: 0.4, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
      { date: '2026-02-20', rating: 7.0, change: 0.3, lobbyTitle: 'נוקטורנל נתניה', lobbyId: 'l5' },
    ],
    lobbyHistory: [
      { lobbyId: 'l1', lobbyTitle: 'משחק ערב בגורדון', date: '2026-04-03', city: 'תל אביב', fieldName: 'מגרש גורדון', ratingChange: 0.3 },
      { lobbyId: 'l6', lobbyTitle: 'אליפות השכונה', date: '2026-03-28', city: 'רמת גן', fieldName: 'מגרש רמת-גן ספורט', ratingChange: 0.2 },
      { lobbyId: 'l4', lobbyTitle: 'סופ"ש 7 על 7', date: '2026-03-01', city: 'ראשון לציון', fieldName: 'מגרש העירייה', ratingChange: 0.4 },
    ],
  },
  {
    id: 'p2', name: 'רועי לוי', initials: 'רל', avatarColor: 'bg-red-500',
    rating: 5.9, gamesPlayed: 23, position: 'קישור',
    bio: 'שחקן מהנתניה, אוהב פאס קצר.',
    ratingHistory: [
      { date: '2026-04-01', rating: 5.9, change: 0.2, lobbyTitle: 'נוקטורנל נתניה', lobbyId: 'l5' },
      { date: '2026-03-22', rating: 5.7, change: -0.2, lobbyTitle: 'משחק בוקר לכל', lobbyId: 'l3' },
      { date: '2026-03-10', rating: 5.9, change: 0.3, lobbyTitle: 'חמישה על חמישה', lobbyId: 'l2' },
    ],
    lobbyHistory: [
      { lobbyId: 'l5', lobbyTitle: 'נוקטורנל נתניה', date: '2026-04-01', city: 'נתניה', fieldName: 'מגרש הים', ratingChange: 0.2 },
      { lobbyId: 'l3', lobbyTitle: 'משחק בוקר לכל', date: '2026-03-22', city: 'ירושלים', fieldName: 'מגרש הגינה הלאומית', ratingChange: -0.2 },
    ],
  },
  {
    id: 'p3', name: 'נועם ברק', initials: 'נב', avatarColor: 'bg-purple-500',
    rating: 9.1, gamesPlayed: 71, position: 'שוער',
    bio: 'שוער מנוסה עם 10+ שנות ניסיון. גובה 1.90.',
    ratingHistory: [
      { date: '2026-04-02', rating: 9.1, change: 0.1, lobbyTitle: 'אימון פרטי מתקדמים', lobbyId: 'l8' },
      { date: '2026-03-25', rating: 9.0, change: 0.2, lobbyTitle: 'חמישה על חמישה', lobbyId: 'l2' },
      { date: '2026-03-18', rating: 8.8, change: 0.3, lobbyTitle: 'אליפות השכונה', lobbyId: 'l6' },
      { date: '2026-03-05', rating: 8.5, change: 0.2, lobbyTitle: 'משחק ערב בגורדון', lobbyId: 'l1' },
    ],
    lobbyHistory: [
      { lobbyId: 'l8', lobbyTitle: 'אימון פרטי מתקדמים', date: '2026-04-02', city: 'פתח תקווה', fieldName: 'מגרש בית-הספר', ratingChange: 0.1 },
      { lobbyId: 'l2', lobbyTitle: 'חמישה על חמישה', date: '2026-03-25', city: 'חיפה', fieldName: 'מגרש הכרמל', ratingChange: 0.2 },
      { lobbyId: 'l6', lobbyTitle: 'אליפות השכונה', date: '2026-03-18', city: 'רמת גן', fieldName: 'מגרש רמת-גן ספורט', ratingChange: 0.3 },
    ],
  },
  {
    id: 'p4', name: 'יוסי מזרחי', initials: 'ימ', avatarColor: 'bg-orange-500',
    rating: 4.2, gamesPlayed: 15, position: 'בלם',
    bio: 'מתחיל אבל נלהב. מגיע לכל אימון.',
    ratingHistory: [
      { date: '2026-04-01', rating: 4.2, change: 0.4, lobbyTitle: 'משחק בוקר לכל', lobbyId: 'l3' },
      { date: '2026-03-20', rating: 3.8, change: 0.3, lobbyTitle: 'כדורגל נשים', lobbyId: 'l7' },
      { date: '2026-03-01', rating: 3.5, change: 0.5, lobbyTitle: 'משחק בוקר לכל', lobbyId: 'l3' },
    ],
    lobbyHistory: [
      { lobbyId: 'l3', lobbyTitle: 'משחק בוקר לכל', date: '2026-04-01', city: 'ירושלים', fieldName: 'מגרש הגינה הלאומית', ratingChange: 0.4 },
      { lobbyId: 'l7', lobbyTitle: 'כדורגל נשים', date: '2026-03-20', city: 'אשדוד', fieldName: 'מגרש אשדוד', ratingChange: 0.3 },
    ],
  },
  {
    id: 'p5', name: 'דניאל שמיר', initials: 'דש', avatarColor: 'bg-pink-500',
    rating: 6.7, gamesPlayed: 34, position: 'אגף',
    bio: 'מהיר, טכני, אוהב לשחק מהאגף הימני.',
    ratingHistory: [
      { date: '2026-04-03', rating: 6.7, change: 0.2, lobbyTitle: 'משחק ערב בגורדון', lobbyId: 'l1' },
      { date: '2026-03-26', rating: 6.5, change: 0.1, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
      { date: '2026-03-12', rating: 6.4, change: -0.1, lobbyTitle: 'אימון פרטי', lobbyId: 'l8' },
    ],
    lobbyHistory: [
      { lobbyId: 'l1', lobbyTitle: 'משחק ערב בגורדון', date: '2026-04-03', city: 'תל אביב', fieldName: 'מגרש גורדון', ratingChange: 0.2 },
      { lobbyId: 'l4', lobbyTitle: 'סופ"ש 7 על 7', date: '2026-03-26', city: 'ראשון לציון', fieldName: 'מגרש העירייה', ratingChange: 0.1 },
    ],
  },
  {
    id: 'p6', name: 'תמיר פרץ', initials: 'תפ', avatarColor: 'bg-teal-500',
    rating: 8.5, gamesPlayed: 92, position: 'קישור',
    bio: 'קפטן קבוע. מארגן משחקים כבר 6 שנים.',
    ratingHistory: [
      { date: '2026-04-04', rating: 8.5, change: 0.1, lobbyTitle: 'אליפות השכונה', lobbyId: 'l6' },
      { date: '2026-03-28', rating: 8.4, change: 0.2, lobbyTitle: 'חמישה על חמישה', lobbyId: 'l2' },
      { date: '2026-03-14', rating: 8.2, change: 0.3, lobbyTitle: 'אימון פרטי', lobbyId: 'l8' },
      { date: '2026-02-28', rating: 7.9, change: 0.2, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
    ],
    lobbyHistory: [
      { lobbyId: 'l6', lobbyTitle: 'אליפות השכונה', date: '2026-04-04', city: 'רמת גן', fieldName: 'מגרש רמת-גן ספורט', ratingChange: 0.1 },
      { lobbyId: 'l2', lobbyTitle: 'חמישה על חמישה', date: '2026-03-28', city: 'חיפה', fieldName: 'מגרש הכרמל', ratingChange: 0.2 },
      { lobbyId: 'l8', lobbyTitle: 'אימון פרטי', date: '2026-03-14', city: 'פתח תקווה', fieldName: 'מגרש בית-הספר', ratingChange: 0.3 },
    ],
  },
  {
    id: 'p7', name: 'Oren Levi', initials: 'OL', avatarColor: 'bg-indigo-500',
    rating: 6.1, gamesPlayed: 29, position: 'Winger',
    bio: 'Playing football for fun since 2018.',
    ratingHistory: [
      { date: '2026-04-02', rating: 6.1, change: 0.3, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
      { date: '2026-03-20', rating: 5.8, change: 0.1, lobbyTitle: 'אימון פרטי', lobbyId: 'l8' },
    ],
    lobbyHistory: [
      { lobbyId: 'l4', lobbyTitle: 'סופ"ש 7 על 7', date: '2026-04-02', city: 'ראשון לציון', fieldName: 'מגרש העירייה', ratingChange: 0.3 },
    ],
  },
  {
    id: 'p8', name: 'מיכל גולן', initials: 'מג', avatarColor: 'bg-rose-500',
    rating: 5.4, gamesPlayed: 41, position: 'חלוצה',
    bio: 'כדורגלנית מאשדוד. מארגנת משחקי נשים.',
    ratingHistory: [
      { date: '2026-04-01', rating: 5.4, change: 0.2, lobbyTitle: 'כדורגל נשים', lobbyId: 'l7' },
      { date: '2026-03-22', rating: 5.2, change: -0.1, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
      { date: '2026-03-08', rating: 5.3, change: 0.3, lobbyTitle: 'משחק ערב בגורדון', lobbyId: 'l1' },
    ],
    lobbyHistory: [
      { lobbyId: 'l7', lobbyTitle: 'כדורגל נשים', date: '2026-04-01', city: 'אשדוד', fieldName: 'מגרש אשדוד', ratingChange: 0.2 },
      { lobbyId: 'l4', lobbyTitle: 'סופ"ש 7 על 7', date: '2026-03-22', city: 'ראשון לציון', fieldName: 'מגרש העירייה', ratingChange: -0.1 },
    ],
  },
  {
    id: 'p9', name: 'שלומי אוחנה', initials: 'שא', avatarColor: 'bg-yellow-600',
    rating: 4.8, gamesPlayed: 18, position: 'בלם',
    bio: 'שחקן מבאר שבע, מגיע לסופי שבוע.',
    ratingHistory: [
      { date: '2026-03-30', rating: 4.8, change: 0.3, lobbyTitle: 'אליפות השכונה', lobbyId: 'l6' },
      { date: '2026-03-15', rating: 4.5, change: 0.2, lobbyTitle: 'משחק בוקר לכל', lobbyId: 'l3' },
    ],
    lobbyHistory: [
      { lobbyId: 'l6', lobbyTitle: 'אליפות השכונה', date: '2026-03-30', city: 'רמת גן', fieldName: 'מגרש רמת-גן ספורט', ratingChange: 0.3 },
    ],
  },
  {
    id: 'p10', name: 'ליאב נחום', initials: 'לנ', avatarColor: 'bg-cyan-500',
    rating: 7.2, gamesPlayed: 57, position: 'קישור',
    bio: 'אוהב פאסים לעומק. משחק במרכז.',
    ratingHistory: [
      { date: '2026-04-03', rating: 7.2, change: 0.2, lobbyTitle: 'חמישה על חמישה', lobbyId: 'l2' },
      { date: '2026-03-25', rating: 7.0, change: 0.1, lobbyTitle: 'אימון פרטי', lobbyId: 'l8' },
      { date: '2026-03-10', rating: 6.9, change: 0.3, lobbyTitle: 'נוקטורנל נתניה', lobbyId: 'l5' },
      { date: '2026-02-25', rating: 6.6, change: 0.2, lobbyTitle: 'סופ"ש 7 על 7', lobbyId: 'l4' },
    ],
    lobbyHistory: [
      { lobbyId: 'l2', lobbyTitle: 'חמישה על חמישה', date: '2026-04-03', city: 'חיפה', fieldName: 'מגרש הכרמל', ratingChange: 0.2 },
      { lobbyId: 'l8', lobbyTitle: 'אימון פרטי', date: '2026-03-25', city: 'פתח תקווה', fieldName: 'מגרש בית-הספר', ratingChange: 0.1 },
      { lobbyId: 'l5', lobbyTitle: 'נוקטורנל נתניה', date: '2026-03-10', city: 'נתניה', fieldName: 'מגרש הים', ratingChange: 0.3 },
    ],
  },
];

const rawMockLobbies: Array<Omit<Lobby, 'organizerIds' | 'accessType' | 'viewerHasAccess' | 'viewerIsInvited' | 'viewerHasFriendInside'>> = [
  {
    id: 'l1', title: 'משחק ערב בגורדון',
    fieldName: 'מגרש גורדון', address: 'שדרות נורדאו 12', city: 'תל אביב',
    datetime: D(0, 19, 0),
    players: [mockPlayers[0], mockPlayers[1], mockPlayers[2], mockPlayers[4], mockPlayers[7]],
    maxPlayers: 10, numTeams: 2, playersPerTeam: 5,
    minRating: 5.0, isPrivate: false, price: 20,
    description: 'משחק שבועי קבוע! אנשים נחמדים. מגיעים 10 דק לפני.',
    createdBy: 'p1', distanceKm: 1.2, waitlist: [], gameType: 'competitive', status: 'active',
  },
  {
    id: 'l2', title: 'חמישה על חמישה – חיפה',
    fieldName: 'מגרש הכרמל', address: 'דרך הכרמל 5', city: 'חיפה',
    datetime: D(1, 18, 0),
    players: [mockPlayers[2], mockPlayers[5], mockPlayers[9]],
    maxPlayers: 10, numTeams: 2, playersPerTeam: 5,
    minRating: 7.0, isPrivate: false, price: 30,
    description: 'מחפשים שחקנים ברמה גבוהה. מינימום דירוג 7.',
    createdBy: 'p3', distanceKm: 2.7, waitlist: [], gameType: 'competitive', status: 'active',
  },
  {
    id: 'l3', title: 'משחק בוקר לכל',
    fieldName: 'מגרש הגינה הלאומית', address: 'שדרות רופין 1', city: 'ירושלים',
    datetime: D(1, 9, 0),
    players: [mockPlayers[3], mockPlayers[6], mockPlayers[8]],
    maxPlayers: 14, numTeams: 2, playersPerTeam: 7,
    minRating: undefined, isPrivate: false, price: 0,
    description: 'משחק כיף לכולם! לא חשוב הרמה, עיקר הכיף.',
    createdBy: 'p4', distanceKm: 0.8, waitlist: [], gameType: 'friendly', status: 'active',
  },
  {
    id: 'l4', title: 'סופ"ש 7 על 7',
    fieldName: 'מגרש העירייה', address: 'שד׳ רוטשילד 22', city: 'ראשון לציון',
    datetime: D(2, 17, 30),
    players: [mockPlayers[0], mockPlayers[2], mockPlayers[4], mockPlayers[5], mockPlayers[6], mockPlayers[7], mockPlayers[8]],
    maxPlayers: 14, numTeams: 2, playersPerTeam: 7,
    minRating: 4.0, isPrivate: false, price: 15,
    description: 'משחק מעורב לסוף שבוע. מקום לעוד 7 שחקנים!',
    createdBy: 'p6', distanceKm: 3.4, waitlist: [], gameType: 'competitive', status: 'active',
  },
  {
    id: 'l5', title: 'נוקטורנל – נתניה',
    fieldName: 'מגרש הים', address: 'הפלמ"ח 3', city: 'נתניה',
    datetime: D(1, 21, 0),
    players: [mockPlayers[1], mockPlayers[9]],
    maxPlayers: 10, numTeams: 2, playersPerTeam: 5,
    minRating: 5.0, isPrivate: false, price: 25,
    description: 'משחק לילי על מגרש מוגש ליד הים. אווירה מיוחדת!',
    createdBy: 'p2', distanceKm: 5.1, waitlist: [], gameType: 'friendly', status: 'active',
  },
  {
    id: 'l6', title: 'אליפות השכונה 🏆',
    fieldName: 'מגרש רמת-גן ספורט', address: 'ביאליק 18', city: 'רמת גן',
    datetime: D(3, 16, 0),
    players: [mockPlayers[5], mockPlayers[3], mockPlayers[7], mockPlayers[9]],
    maxPlayers: 10, numTeams: 2, playersPerTeam: 5,
    minRating: 6.0, isPrivate: false, price: 20,
    description: 'תחרות שכונתית לא רשמית. מגיעים בזמן!',
    createdBy: 'p6', distanceKm: 4.2, waitlist: [], gameType: 'competitive', status: 'active',
  },
  {
    id: 'l7', title: 'כדורגל נשים',
    fieldName: 'מגרש אשדוד', address: 'שד׳ הנשיא 7', city: 'אשדוד',
    datetime: D(2, 10, 0),
    players: [mockPlayers[7], mockPlayers[4]],
    maxPlayers: 10, numTeams: 2, playersPerTeam: 5,
    minRating: undefined, isPrivate: false, price: 0,
    description: 'קבוצת נשים ובנות. רמה מתחילה–בינונית. כולן מוזמנות!',
    createdBy: 'p8', distanceKm: 7.8, waitlist: [], gameType: 'friendly', status: 'active',
  },
  {
    // l8 is FULL (maxPlayers=6, has 6 players) — demonstrates the waitlist feature
    id: 'l8', title: 'אימון פרטי – מתקדמים',
    fieldName: 'מגרש בית-הספר', address: 'הרצל 44', city: 'פתח תקווה',
    datetime: D(0, 20, 30),
    players: [mockPlayers[2], mockPlayers[5], mockPlayers[0], mockPlayers[9], mockPlayers[1], mockPlayers[6]],
    maxPlayers: 6, numTeams: 2, playersPerTeam: 3,
    minRating: 7.5, isPrivate: true, price: 40,
    description: 'קבוצה של חברים קבועים. מחפשים שחקן שישלים.',
    createdBy: 'p3', distanceKm: 6.3,
    waitlist: [mockPlayers[3], mockPlayers[8]], gameType: 'competitive', status: 'active',
  },
];

export const mockLobbies: Lobby[] = rawMockLobbies.map((lobby) => ({
  ...lobby,
  organizerIds: [],
  accessType: lobby.isPrivate ? 'locked' : 'open',
  viewerHasAccess: true,
  viewerIsInvited: false,
  viewerHasFriendInside: false,
}));

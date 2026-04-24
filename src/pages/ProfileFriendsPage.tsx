import { Search, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';

export default function ProfileFriendsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser, getAllUsers } = useAuth();
  const [query, setQuery] = useState('');

  const allUsers = getAllUsers();
  const profile = allUsers.find((user) => user.id === id) ?? null;
  const isMe = currentUser?.id === id;
  const friendsSource = isMe && currentUser ? currentUser : profile;

  const friends = useMemo(() => {
    if (!friendsSource) {
      return [];
    }

    return friendsSource.friends
      .map((friendId) => allUsers.find((user) => user.id === friendId))
      .filter((user): user is NonNullable<typeof profile> => Boolean(user));
  }, [allUsers, friendsSource, profile]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) {
      return friends;
    }

    return friends.filter((friend) => {
      const haystack = `${friend.name} ${friend.position ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [friends, normalizedQuery]);

  if (!profile && allUsers.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500">
        {lang === 'he' ? 'טוען חברים...' : 'Loading friends...'}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-gray-500">{lang === 'he' ? 'המשתמש לא נמצא' : 'User not found'}</p>
        <div className="mt-4">
          <BackButton onClick={() => navigate(-1)} />
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton onClick={() => navigate(-1)} className="mb-6" />

      <section className="mb-4 rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lang === 'he'
                ? isMe ? 'כל החברים שלי' : `החברים של ${profile.name}`
                : isMe ? 'My friends' : `${profile.name}'s friends`}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {lang === 'he'
                ? `${friends.length} חברים`
                : `${friends.length} friends`}
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lang === 'he' ? 'חפש חברים' : 'Search friends'}
            className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {filteredFriends.length > 0 ? (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => navigate(`/profile/${friend.id}`)}
                className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-start transition-colors hover:bg-gray-100"
              >
                {friend.photoUrl ? (
                  <img src={friend.photoUrl} alt={friend.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${friend.avatarColor} text-sm font-bold text-white`}>
                    {friend.initials}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-gray-900">{friend.name}</p>
                  {friend.position ? <p className="mt-1 text-sm text-gray-500">{friend.position}</p> : null}
                </div>

                <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700">
                  <Trophy size={14} />
                  {friend.competitivePoints ?? 0}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 px-4 py-12 text-center text-sm text-gray-500">
            {lang === 'he'
              ? normalizedQuery ? 'לא נמצאו חברים שמתאימים לחיפוש.' : 'עדיין אין חברים להצגה.'
              : normalizedQuery ? 'No friends match this search.' : 'No friends to show yet.'}
          </div>
        )}
      </section>
    </main>
  );
}

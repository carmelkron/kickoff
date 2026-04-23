import { useEffect, useState } from 'react';
import { ArrowRight, Lock, MapPin, Trophy, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchLobbies, requestLobbyAccess, upsertLobbyMembership } from '../lib/appData';
import type { Lobby } from '../types';
import { formatDateTime } from '../utils/format';

function getLobbyPrimaryActionLabel(lobby: Lobby, lang: 'he' | 'en') {
  const isFull = lobby.players.length >= lobby.maxPlayers;

  if (lobby.viewerJoinRequestStatus === 'pending') {
    return lang === 'he' ? 'בקשה נשלחה' : 'Request sent';
  }

  if (isFull) {
    return lang === 'he' ? 'מלא' : 'Full';
  }

  if (lobby.accessType === 'locked' && !lobby.viewerHasAccess) {
    return lang === 'he' ? 'בקש גישה' : 'Request access';
  }

  return lang === 'he' ? 'הצטרף ללובי' : 'Join lobby';
}

function HomeLobbyFeedCard({
  lobby,
  currentUserId,
  onOpen,
  onPrimaryAction,
  pendingActionId,
}: {
  lobby: Lobby;
  currentUserId?: string;
  onOpen: () => void;
  onPrimaryAction: () => void;
  pendingActionId: string;
}) {
  const { lang } = useLang();
  const isFull = lobby.players.length >= lobby.maxPlayers;
  const primaryLabel = getLobbyPrimaryActionLabel(lobby, lang);
  const primaryDisabled = pendingActionId === lobby.id || lobby.viewerJoinRequestStatus === 'pending' || isFull;

  return (
    <article className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-white px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              lobby.gameType === 'competitive'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {lobby.gameType === 'competitive' ? <Trophy size={12} /> : <Users size={12} />}
            <span>{lobby.gameType === 'competitive' ? (lang === 'he' ? 'תחרותי' : 'Competitive') : (lang === 'he' ? 'ידידותי' : 'Friendly')}</span>
          </div>
          {lobby.accessType === 'locked' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
              <Lock size={12} />
              <span>{lang === 'he' ? 'לובי נעול' : 'Locked lobby'}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">{lobby.city}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{lobby.title}</h2>
          </div>
          <div className="rounded-3xl bg-gray-50 px-4 py-3 text-end">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {lang === 'he' ? 'שחקנים' : 'Players'}
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {lobby.players.length}/{lobby.maxPlayers}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="flex items-center gap-3 rounded-[24px] bg-gray-50 px-4 py-3">
          <MapPin size={18} className="text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {formatDateTime(
                lobby.datetime,
                lang,
                lang === 'he' ? 'היום' : 'Today',
                lang === 'he' ? 'מחר' : 'Tomorrow',
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500">{lobby.address}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatPill
            title={lang === 'he' ? 'מארגן' : 'Organizer'}
            value={lobby.createdBy === currentUserId ? (lang === 'he' ? 'אתה' : 'You') : (lang === 'he' ? 'צוות מארגן' : 'Organizer team')}
          />
          <StatPill
            title={lang === 'he' ? 'גישה' : 'Access'}
            value={
              lobby.accessType === 'locked'
                ? (lobby.viewerHasAccess ? (lang === 'he' ? 'מאושר' : 'Approved') : (lang === 'he' ? 'דורש אישור' : 'Approval needed'))
                : (lang === 'he' ? 'פתוח' : 'Open')
            }
          />
          <StatPill
            title={lang === 'he' ? 'מחיר' : 'Price'}
            value={lobby.price && lobby.price > 0 ? `₪${lobby.price}` : (lang === 'he' ? 'חינם' : 'Free')}
          />
          <StatPill
            title={lang === 'he' ? 'חברים בפנים' : 'Friends inside'}
            value={lobby.viewerHasFriendInside ? (lang === 'he' ? 'כן' : 'Yes') : (lang === 'he' ? 'עדיין לא' : 'Not yet')}
          />
        </div>

        {lobby.description && (
          <p className="text-sm leading-7 text-gray-600">{lobby.description}</p>
        )}

        {lobby.viewerHasFriendInside && (
          <div className="rounded-[24px] border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700">
            {lang === 'he'
              ? 'יש כבר חברים שלך בפנים. שווה להצטרף לפני שהמקומות ייגמרו.'
              : 'Friends are already inside. Worth jumping in before the spots run out.'}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="flex-1 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pendingActionId === lobby.id ? (lang === 'he' ? 'שולח...' : 'Working...') : primaryLabel}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
          >
            {lang === 'he' ? 'פתח לובי' : 'Open lobby'}
            <ArrowRight size={15} className={lang === 'he' ? '' : 'rotate-180'} />
          </button>
        </div>
      </div>
    </article>
  );
}

function StatPill({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function HomeLive() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  async function loadLobbies() {
    try {
      setLoading(true);
      setLoadError('');
      const nextLobbies = await fetchLobbies();
      setLobbies(nextLobbies.filter((lobby) => lobby.status === 'active'));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load lobbies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLobbies();
  }, []);

  async function handlePrimaryAction(lobby: Lobby) {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (lobby.viewerJoinRequestStatus === 'pending' || lobby.players.length >= lobby.maxPlayers) {
      return;
    }

    setPendingActionId(lobby.id);
    try {
      if (lobby.accessType === 'locked' && !lobby.viewerHasAccess) {
        await requestLobbyAccess(lobby.id, currentUser.id);
      } else {
        await upsertLobbyMembership(lobby.id, currentUser.id, 'joined');
      }
      await loadLobbies();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setPendingActionId('');
    }
  }

  return (
    <section className="pb-4">
      {loadError && (
        <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--muted)]">
          {lang === 'he' ? 'טוען לובים...' : 'Loading lobbies...'}
        </p>
      ) : lobbies.length === 0 ? (
        <div className="mt-6 rounded-[32px] border border-[var(--app-border)] bg-[var(--panel)] px-6 py-16 text-center shadow-sm">
          <p className="text-lg font-semibold text-[var(--text)]">
            {lang === 'he' ? 'אין כרגע לובים זמינים' : 'No lobbies are available right now'}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {lang === 'he'
              ? 'נסה שוב עוד מעט או צור לובי חדש בעצמך.'
              : 'Check back soon or create a new lobby yourself.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {lobbies.map((lobby) => (
            <HomeLobbyFeedCard
              key={lobby.id}
              lobby={lobby}
              currentUserId={currentUser?.id}
              pendingActionId={pendingActionId}
              onOpen={() => navigate(`/lobby/${lobby.id}`)}
              onPrimaryAction={() => void handlePrimaryAction(lobby)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

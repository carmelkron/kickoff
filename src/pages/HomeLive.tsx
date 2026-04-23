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

  if (lobby.players.some((player) => player.id === lobby.createdBy)) {
    // no-op special handling stays with status logic below
  }

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
    <article className="overflow-hidden rounded-[34px] border border-[var(--app-border)] bg-[var(--panel)] shadow-[0_28px_90px_rgba(7,19,16,0.08)]">
      <div className="h-40 bg-[linear-gradient(135deg,rgba(15,127,84,0.22),rgba(15,127,84,0.04))] px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm">
            {lobby.gameType === 'competitive' ? <Trophy size={12} className="text-[var(--accent)]" /> : <Users size={12} className="text-[var(--accent)]" />}
            <span>{lobby.gameType === 'competitive' ? (lang === 'he' ? 'תחרותי' : 'Competitive') : (lang === 'he' ? 'ידידותי' : 'Friendly')}</span>
          </div>
          {lobby.accessType === 'locked' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white">
              <Lock size={12} />
              <span>{lang === 'he' ? 'לובי נעול' : 'Locked lobby'}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--muted)]">{lobby.city}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">{lobby.title}</h2>
          </div>
          <div className="rounded-3xl bg-white/75 px-4 py-3 text-end shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {lang === 'he' ? 'שחקנים' : 'Players'}
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">
              {lobby.players.length}/{lobby.maxPlayers}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="flex items-center gap-3 rounded-[24px] bg-[var(--surface)] px-4 py-3">
          <MapPin size={18} className="text-[var(--accent)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">{formatDateTime(lobby.datetime, lang, lang === 'he' ? 'היום' : 'Today', lang === 'he' ? 'מחר' : 'Tomorrow')}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{lobby.address}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatPill
            title={lang === 'he' ? 'מארגן' : 'Organizer'}
            value={lobby.createdBy === currentUserId ? (lang === 'he' ? 'אתה' : 'You') : (lang === 'he' ? 'צוות מארגן' : 'Organizer team')}
          />
          <StatPill
            title={lang === 'he' ? 'גישה' : 'Access'}
            value={lobby.accessType === 'locked' ? (lobby.viewerHasAccess ? (lang === 'he' ? 'מאושר' : 'Approved') : (lang === 'he' ? 'דורש אישור' : 'Approval needed')) : (lang === 'he' ? 'פתוח' : 'Open')}
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
          <p className="text-sm leading-7 text-[var(--muted)]">{lobby.description}</p>
        )}

        {lobby.viewerHasFriendInside && (
          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
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
            className="flex-1 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,127,84,0.24)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pendingActionId === lobby.id ? (lang === 'he' ? 'שולח...' : 'Working...') : primaryLabel}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-5 py-3 text-sm font-semibold text-[var(--text)]"
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
    <div className="rounded-[22px] border border-[var(--app-border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{value}</p>
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
      <div className="rounded-[32px] bg-[linear-gradient(135deg,rgba(15,127,84,0.18),rgba(15,127,84,0.02))] px-6 py-7 shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          KickOff Feed
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
          {lang === 'he' ? 'מוצאים לובי אחד מעולה בכל פעם' : 'Discover one great lobby at a time'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          {lang === 'he'
            ? 'הפיד החדש ממוקד לגמרי במציאת לובים. כל כרטיס מספר מהר מה חשוב: מי בפנים, איפה זה קורה, ומה צריך לעשות כדי להצטרף.'
            : 'The new home feed is all about finding lobbies fast. Each card tells you who is inside, where it happens, and what it takes to join.'}
        </p>
      </div>

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
        <div className="mt-6 rounded-[32px] border border-[var(--app-border)] bg-[var(--panel)] px-6 py-16 text-center shadow-[0_24px_70px_rgba(7,19,16,0.05)]">
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
        <div className="mt-6 space-y-6">
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

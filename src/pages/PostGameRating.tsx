import { useEffect, useState } from 'react';
import { ChevronLeft, Star } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { fetchLobbyById, hasAlreadyRated, submitLobbyRatings } from '../lib/appData';
import type { Lobby, Player } from '../types';

const GAME_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type GameLevel = (typeof GAME_LEVELS)[number];

export default function PostGameRating() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { currentUser } = useAuth();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [done, setDone] = useState(false);

  // Per-player ratings (1–10)
  const [playerRatings, setPlayerRatings] = useState<Record<string, number>>({});
  // Field rating (1–5)
  const [fieldRating, setFieldRating] = useState(3);
  // Game level
  const [gameLevel, setGameLevel] = useState<GameLevel>('intermediate');

  useEffect(() => {
    if (!id || !currentUser) return;

    async function load() {
      try {
        setLoading(true);
        const [nextLobby, rated] = await Promise.all([
          fetchLobbyById(id!),
          hasAlreadyRated(id!, currentUser!.id),
        ]);
        setLobby(nextLobby);
        setAlreadyRated(rated);

        if (nextLobby) {
          const initial: Record<string, number> = {};
          for (const player of nextLobby.players) {
            if (player.id !== currentUser!.id) {
              initial[player.id] = 5;
            }
          }
          setPlayerRatings(initial);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id, currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!id) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        {lang === 'he' ? 'טוען...' : 'Loading...'}
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">{lang === 'he' ? 'המשחק לא נמצא' : 'Game not found'}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-primary-600 underline">
          {lang === 'he' ? 'חזרה' : 'Back'}
        </button>
      </div>
    );
  }

  if (lobby.gameType !== 'competitive') {
    return <Navigate to={`/lobby/${id}`} replace />;
  }

  const gameHasPassed = new Date(lobby.datetime) < new Date();
  const withinWindow = (new Date().getTime() - new Date(lobby.datetime).getTime()) < 24 * 60 * 60 * 1000;
  const iAmParticipant = lobby.players.some((p) => p.id === currentUser.id);

  if (!gameHasPassed || !withinWindow || !iAmParticipant) {
    return <Navigate to={`/lobby/${id}`} replace />;
  }

  if (alreadyRated || done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">⭐</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {lang === 'he' ? 'תודה על הדירוג!' : 'Thanks for rating!'}
        </h2>
        <p className="text-gray-500 mb-6">
          {lang === 'he' ? 'הדירוגים הוגשו בצורה אנונימית' : 'Your ratings were submitted anonymously'}
        </p>
        <button
          onClick={() => navigate(`/lobby/${id}`)}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
        >
          {lang === 'he' ? 'חזרה למשחק' : 'Back to game'}
        </button>
      </div>
    );
  }

  const otherPlayers: Player[] = lobby.players.filter((p) => p.id !== currentUser.id);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await submitLobbyRatings({
        lobbyId: id!,
        raterProfileId: currentUser!.id,
        playerRatings: otherPlayers.map((p) => ({
          ratedProfileId: p.id,
          rating: playerRatings[p.id] ?? 5,
        })),
        fieldRating,
        gameLevel,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ratings');
    } finally {
      setSubmitting(false);
    }
  }

  const gameLevelLabel: Record<GameLevel, string> = {
    beginner: lang === 'he' ? 'מתחיל' : 'Beginner',
    intermediate: lang === 'he' ? 'בינוני' : 'Intermediate',
    advanced: lang === 'he' ? 'מתקדם' : 'Advanced',
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors">
        <ChevronLeft size={16} />
        {lang === 'he' ? 'חזרה' : 'Back'}
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'he' ? 'דרג את המשחק' : 'Rate the game'}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {lang === 'he' ? 'הדירוגים אנונימיים — שחקנים לא יודעים מי דירג אותם' : 'Ratings are anonymous — players won\'t know who rated them'}
        </p>
        <p className="text-gray-400 text-xs mt-1">{lobby.title}</p>
      </div>

      <div className="space-y-4">
        {/* Player ratings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm">
            {lang === 'he' ? 'דרג שחקנים (1–10)' : 'Rate players (1–10)'}
          </h2>
          <div className="space-y-4">
            {otherPlayers.map((player) => (
              <div key={player.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full ${player.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {player.initials}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-800">{player.name}</span>
                  </div>
                  <span className="text-sm font-bold text-primary-600">★ {(playerRatings[player.id] ?? 5).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={playerRatings[player.id] ?? 5}
                  onChange={(e) => setPlayerRatings((prev) => ({ ...prev, [player.id]: parseFloat(e.target.value) }))}
                  className="w-full accent-primary-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Field rating */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">
            {lang === 'he' ? 'דרג את המגרש' : 'Rate the field'}
          </h2>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFieldRating(star)}
                className="text-2xl transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className={star <= fieldRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Game level */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">
            {lang === 'he' ? 'רמת המשחק' : 'Game level'}
          </h2>
          <div className="flex gap-2">
            {GAME_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setGameLevel(level)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  gameLevel === level
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                {gameLevelLabel[level]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          onClick={() => void handleSubmit()}
          disabled={submitting || otherPlayers.length === 0}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-base transition-colors shadow-md hover:shadow-lg"
        >
          {submitting
            ? (lang === 'he' ? 'שולח...' : 'Submitting...')
            : (lang === 'he' ? 'שלח דירוג' : 'Submit rating')}
        </button>
      </div>
    </main>
  );
}

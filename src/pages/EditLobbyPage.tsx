import { useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { fetchLobbyById, updateLobby } from '../lib/appData';
import { buildLobbyDateTime, validateCreateLobbyDraft } from '../lib/validation';
import type { FieldType, GameType, GenderRestriction, Lobby, LobbyAccessType } from '../types';
import GooglePlacesAutocomplete, { type PlaceResult } from '../components/GooglePlacesAutocomplete';
import SelectedPlaceNotice from '../components/SelectedPlaceNotice';
import { formatLocationLabel } from '../utils/location';

const TEAM_OPTIONS = [2, 3, 4];

export default function EditLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t, lang } = useLang();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [gameType, setGameType] = useState<GameType>('friendly');
  const [accessType, setAccessType] = useState<LobbyAccessType>('open');
  const [fieldType, setFieldType] = useState<FieldType | ''>('');
  const [genderRestriction, setGenderRestriction] = useState<GenderRestriction>('none');
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    numTeams: 2,
    playersPerTeam: 5,
    minPointsPerGame: '',
    minAge: '',
    maxAge: '',
    price: '',
    description: '',
  });

  useEffect(() => {
    if (!id) return;
    fetchLobbyById(id).then((nextLobby) => {
      setLobby(nextLobby);
      if (nextLobby) {
        const dt = new Date(nextLobby.datetime);
        const pad = (n: number) => String(n).padStart(2, '0');
        setForm({
          title: nextLobby.title,
          date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
          time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
          numTeams: nextLobby.numTeams ?? 2,
          playersPerTeam: nextLobby.playersPerTeam ?? 5,
          minPointsPerGame: nextLobby.minPointsPerGame != null ? String(nextLobby.minPointsPerGame) : '',
          minAge: nextLobby.minAge != null ? String(nextLobby.minAge) : '',
          maxAge: nextLobby.maxAge != null ? String(nextLobby.maxAge) : '',
          price: nextLobby.price ? String(nextLobby.price) : '',
          description: nextLobby.description ?? '',
        });
        setGameType(nextLobby.gameType);
        setAccessType(nextLobby.accessType);
        setFieldType(nextLobby.fieldType ?? '');
        setGenderRestriction(nextLobby.genderRestriction);
        setSelectedPlace({
          address: nextLobby.address,
          city: nextLobby.city,
          latitude: nextLobby.latitude ?? 0,
          longitude: nextLobby.longitude ?? 0,
          placeId: '',
        });
      }
      setLoading(false);
    });
  }, [id]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!id) return <Navigate to="/" replace />;

  if (loading) {
    return <div className="max-w-lg mx-auto px-4 py-20 text-center text-gray-500">{lang === 'he' ? 'טוען...' : 'Loading...'}</div>;
  }

  if (!lobby || lobby.createdBy !== currentUser.id) {
    return <Navigate to={`/lobby/${id}`} replace />;
  }

  function setField(key: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const datetime = buildLobbyDateTime(form.date, form.time);
    const minPointsPerGame = gameType === 'competitive' && form.minPointsPerGame ? Number(form.minPointsPerGame) : undefined;
    const minAge = form.minAge ? Number(form.minAge) : undefined;
    const maxAge = form.maxAge ? Number(form.maxAge) : undefined;
    if (!datetime) {
      setError(lang === 'he' ? 'בחר תאריך ושעה תקינים' : 'Choose a valid date and time.');
      setSubmitting(false);
      return;
    }

    if (!selectedPlace) {
      setError(lang === 'he' ? 'יש לבחור מיקום מהרשימה' : 'Please select a location from the list');
      setSubmitting(false);
      return;
    }

    const validationErrors = validateCreateLobbyDraft({
      title: form.title,
      address: selectedPlace.address,
      city: selectedPlace.city,
      date: form.date,
      time: form.time,
      numTeams: form.numTeams,
      playersPerTeam: form.playersPerTeam,
      accessType,
      minPointsPerGame,
      minAge,
      maxAge,
      price: form.price ? Number(form.price) : undefined,
      description: form.description,
    });
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setSubmitting(false);
      return;
    }

    try {
      await updateLobby({
        lobbyId: id!,
        title: form.title,
        address: selectedPlace.address,
        city: selectedPlace.city,
        datetime: datetime.toISOString(),
        numTeams: form.numTeams,
        playersPerTeam: form.playersPerTeam,
        minPointsPerGame,
        minAge,
        maxAge,
        price: form.price ? Number(form.price) : undefined,
        description: form.description || undefined,
        gameType,
        accessType,
        fieldType: fieldType || undefined,
        genderRestriction,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      });
      navigate(`/lobby/${id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update game');
      setSubmitting(false);
    }
  }

  const maxPlayers = form.numTeams * form.playersPerTeam;

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'he' ? 'עריכת משחק' : 'Edit game'}</h1>
        <p className="text-gray-500 mt-1 text-sm">{lobby.title}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'גישה ללובי' : 'Lobby access'}</label>
            <div className="flex gap-2">
              {(['open', 'locked'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccessType(type)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    accessType === type
                      ? type === 'open'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {type === 'open'
                    ? (lang === 'he' ? 'פתוח' : 'Open')
                    : (lang === 'he' ? 'נעול' : 'Locked')}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {accessType === 'open'
                ? (lang === 'he' ? 'כל משתמש יכול לפתוח את הלובי ולהצטרף לפי הזמינות.' : 'Anyone can open the lobby and join if space is available.')
                : (lang === 'he' ? 'רק משתתפים, מוזמנים, או חברים של מי שכבר בפנים יוכלו להיכנס ללובי.' : 'Only participants, invited players, or friends of players already inside can access this lobby.')}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'סוג משחק' : 'Game type'}</label>
            <div className="flex gap-2">
              {(['friendly', 'competitive'] as const).map((type) => (
                <button key={type} type="button" onClick={() => setGameType(type)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${gameType === type ? (type === 'friendly' ? 'bg-green-500 text-white border-green-500' : 'bg-primary-600 text-white border-primary-600') : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {type === 'friendly' ? (lang === 'he' ? '🤝 ידידותי' : '🤝 Friendly') : (lang === 'he' ? '🏆 תחרותי' : '🏆 Competitive')}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <Field label={lang === 'he' ? 'שם המשחק' : 'Game name'}>
            <Input value={form.title} onChange={setField('title')} required />
          </Field>
        </Card>

        <Card>
          <Field label={lang === 'he' ? 'מיקום המגרש' : 'Field location'}>
            <GooglePlacesAutocomplete
              value={selectedPlace ? formatLocationLabel(selectedPlace.address, selectedPlace.city) : ''}
              onSelect={setSelectedPlace}
              onClear={() => setSelectedPlace(null)}
              placeholder={lang === 'he' ? 'חפש כתובת או עיר...' : 'Search address or city...'}
              required
            />
            {selectedPlace && <SelectedPlaceNotice place={selectedPlace} lang={lang} />}
          </Field>
        </Card>

        <Card>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.create.date}>
              <Input type="date" value={form.date} onChange={setField('date')} required />
            </Field>
            <Field label={t.create.time}>
              <Input type="time" value={form.time} onChange={setField('time')} required />
            </Field>
          </div>
        </Card>

        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'מספר קבוצות' : 'Number of teams'}</label>
            <div className="flex gap-2">
              {TEAM_OPTIONS.map((count) => (
                <button key={count} type="button" onClick={() => setForm((prev) => ({ ...prev, numTeams: count }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${form.numTeams === count ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {count} {lang === 'he' ? 'קבוצות' : 'teams'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">{lang === 'he' ? 'שחקנים לקבוצה' : 'Players per team'}</label>
              <span className="text-sm font-bold text-primary-600">{form.playersPerTeam}</span>
            </div>
            <input type="range" min="3" max="11" step="1" value={form.playersPerTeam}
              onChange={(e) => setForm((prev) => ({ ...prev, playersPerTeam: Number(e.target.value) }))}
              className="w-full accent-primary-600" />
          </div>
          <div className="bg-primary-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-primary-700 font-medium">{lang === 'he' ? 'סה"כ שחקנים מקסימלי:' : 'Total max players:'}</span>
            <span className="text-lg font-bold text-primary-700">{maxPlayers}</span>
          </div>
        </Card>

        <Card>
          <Field label={t.create.price}>
            <Input type="number" min="0" value={form.price} onChange={setField('price')} placeholder={t.create.pricePlaceholder} />
          </Field>
        </Card>

        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'סוג מגרש (אופציונלי)' : 'Field type (optional)'}</label>
            <div className="flex gap-2">
              {([['grass', lang === 'he' ? '🌿 דשא' : '🌿 Grass'], ['asphalt', lang === 'he' ? '⬛ אספלט' : '⬛ Asphalt'], ['indoor', lang === 'he' ? '🏟️ אולם' : '🏟️ Indoor']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setFieldType((prev) => prev === val ? '' : val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${fieldType === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'מגבלת מגדר' : 'Gender restriction'}</label>
            <div className="flex gap-2">
              {([['none', lang === 'he' ? 'כולם' : 'All'], ['male', lang === 'he' ? '👨 גברים' : '👨 Men only'], ['female', lang === 'he' ? '👩 נשים' : '👩 Women only']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setGenderRestriction(val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${genderRestriction === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'he' ? 'טווח גילאים (אופציונלי)' : 'Age range (optional)'}</label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min="6"
                max="99"
                value={form.minAge}
                onChange={setField('minAge')}
                placeholder={lang === 'he' ? 'מגיל' : 'Min age'}
              />
              <Input
                type="number"
                min="6"
                max="99"
                value={form.maxAge}
                onChange={setField('maxAge')}
                placeholder={lang === 'he' ? 'עד גיל' : 'Max age'}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {lang === 'he'
                ? 'רק שחקנים שהגיל שלהם מתאים בתאריך המשחק יוכלו להצטרף.'
                : 'Only players whose age matches on game day will be able to join.'}
            </p>
          </div>
        </Card>

        {gameType === 'competitive' && (
          <Card>
            <Field label={lang === 'he' ? 'מינימום נקודות למשחק להצטרפות (אופציונלי)' : 'Minimum points per game to join (optional)'}>
              <Input
                type="number"
                min="0"
                max="99.99"
                step="0.1"
                value={form.minPointsPerGame}
                onChange={setField('minPointsPerGame')}
                placeholder={lang === 'he' ? 'למשל 8.5' : 'e.g. 8.5'}
              />
            </Field>
            <p className="text-xs text-gray-400">
              {lang === 'he'
                ? 'רק שחקנים שממוצע הנקודות התחרותיות שלהם למשחק עומד בסף הזה יוכלו להצטרף.'
                : 'Only players whose average competitive points per game meets this bar will be able to join.'}
            </p>
          </Card>
        )}

        <Card>
          <Field label={t.create.description}>
            <textarea value={form.description} onChange={setField('description')} rows={3}
              placeholder={t.create.descriptionPlaceholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </Field>
        </Card>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-base transition-colors shadow-md hover:shadow-lg">
          {submitting ? (lang === 'he' ? 'שומר...' : 'Saving...') : (lang === 'he' ? 'שמור שינויים' : 'Save changes')}
        </button>
      </form>
    </main>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent" />
  );
}

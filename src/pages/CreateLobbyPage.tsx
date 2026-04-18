import { useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { createLobby, fetchLobbyById, reinviteLobbyParticipants } from '../lib/appData';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { buildLobbyDateTime, validateCreateLobbyDraft } from '../lib/validation';
import type { GameType, FieldType, GenderRestriction, Lobby, LobbyAccessType } from '../types';
import GooglePlacesAutocomplete, { type PlaceResult } from '../components/GooglePlacesAutocomplete';
import SelectedPlaceNotice from '../components/SelectedPlaceNotice';
import { formatLocationLabel } from '../utils/location';

const TEAM_OPTIONS = [2, 3, 4];

export default function CreateLobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { t, lang } = useLang();
  const duplicateFromLobbyId = new URLSearchParams(location.search).get('duplicateFrom');
  const [gameType, setGameType] = useState<GameType>('friendly');
  const [accessType, setAccessType] = useState<LobbyAccessType>('open');
  const [fieldType, setFieldType] = useState<FieldType | ''>('');
  const [genderRestriction, setGenderRestriction] = useState<GenderRestriction>('none');
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
  const [manualLocation, setManualLocation] = useState({
    address: '',
    city: '',
  });
  const [duplicateSourceLobby, setDuplicateSourceLobby] = useState<Lobby | null>(null);
  const [loadingDuplicateSource, setLoadingDuplicateSource] = useState(false);
  const [invitePreviousParticipants, setInvitePreviousParticipants] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const currentUserId = currentUser.id;
  const maxPlayers = form.numTeams * form.playersPerTeam;
  const locationDisplayValue = selectedPlace
    ? formatLocationLabel(selectedPlace.address, selectedPlace.city)
    : formatLocationLabel(manualLocation.address, manualLocation.city);

  useEffect(() => {
    if (!duplicateFromLobbyId) {
      setDuplicateSourceLobby(null);
      setLoadingDuplicateSource(false);
      setInvitePreviousParticipants(false);
      return;
    }

    let cancelled = false;
    setLoadingDuplicateSource(true);
    setError('');

    void fetchLobbyById(duplicateFromLobbyId)
      .then((nextLobby) => {
        if (cancelled) {
          return;
        }

        if (!nextLobby) {
          setDuplicateSourceLobby(null);
          setError(lang === 'he' ? 'לא הצלחתי לטעון את הלובי שרצית לשכפל.' : 'Failed to load the lobby you wanted to duplicate.');
          return;
        }

        setDuplicateSourceLobby(nextLobby);
        setGameType(nextLobby.gameType);
        setAccessType(nextLobby.accessType);
        setFieldType(nextLobby.fieldType ?? '');
        setGenderRestriction(nextLobby.genderRestriction);
        setForm({
          title: nextLobby.title,
          date: '',
          time: '',
          numTeams: nextLobby.numTeams ?? 2,
          playersPerTeam: nextLobby.playersPerTeam ?? 5,
          minPointsPerGame: nextLobby.minPointsPerGame != null ? String(nextLobby.minPointsPerGame) : '',
          minAge: nextLobby.minAge != null ? String(nextLobby.minAge) : '',
          maxAge: nextLobby.maxAge != null ? String(nextLobby.maxAge) : '',
          price: nextLobby.price != null ? String(nextLobby.price) : '',
          description: nextLobby.description ?? '',
        });
        setManualLocation({
          address: nextLobby.address,
          city: nextLobby.city,
        });
        setSelectedPlace(
          nextLobby.latitude != null && nextLobby.longitude != null
            ? {
                address: nextLobby.address,
                city: nextLobby.city,
                latitude: nextLobby.latitude,
                longitude: nextLobby.longitude,
                placeId: '',
              }
            : null,
        );
        setInvitePreviousParticipants(false);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        setDuplicateSourceLobby(null);
        setError(nextError instanceof Error ? nextError.message : (lang === 'he' ? 'שכפול הלובי נכשל.' : 'Failed to duplicate the lobby.'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDuplicateSource(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [duplicateFromLobbyId]);

  useEffect(() => {
    if (accessType !== 'locked' && invitePreviousParticipants) {
      setInvitePreviousParticipants(false);
    }
  }, [accessType, invitePreviousParticipants]);

  function setField(key: 'title' | 'date' | 'time' | 'minPointsPerGame' | 'minAge' | 'maxAge' | 'price' | 'description') {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const numericPrice = form.price ? Number(form.price) : undefined;
    const minPointsPerGame = gameType === 'competitive' && form.minPointsPerGame ? Number(form.minPointsPerGame) : undefined;
    const minAge = form.minAge ? Number(form.minAge) : undefined;
    const maxAge = form.maxAge ? Number(form.maxAge) : undefined;
    const address = (selectedPlace?.address ?? manualLocation.address).trim();
    const city = (selectedPlace?.city ?? manualLocation.city).trim();
    const validationErrors = validateCreateLobbyDraft({
      title: form.title,
      address,
      city,
      date: form.date,
      time: form.time,
      numTeams: form.numTeams,
      playersPerTeam: form.playersPerTeam,
      accessType,
      minPointsPerGame,
      minAge,
      maxAge,
      price: numericPrice,
      description: form.description,
    });

    if (!address || !city) {
      setError(lang === 'he' ? 'יש לבחור מיקום מהרשימה או למלא כתובת ועיר ידנית.' : 'Please select a location from the list or fill in the address and city manually.');
      setSubmitting(false);
      return;
    }

    const datetime = buildLobbyDateTime(form.date, form.time);
    if (validationErrors.length > 0 || !datetime) {
      setError(validationErrors[0] ?? 'Choose a valid date and time.');
      setSubmitting(false);
      return;
    }

    try {
      const lobbyId = await createLobby({
        title: form.title,
        address,
        city,
        datetime: datetime.toISOString(),
        maxPlayers,
        numTeams: form.numTeams,
        playersPerTeam: form.playersPerTeam,
        minPointsPerGame,
        minAge,
        maxAge,
        price: numericPrice,
        description: form.description || undefined,
        createdBy: currentUserId,
        gameType,
        accessType,
        fieldType: fieldType || undefined,
        genderRestriction,
        latitude: selectedPlace?.latitude,
        longitude: selectedPlace?.longitude,
      });

      let duplicationSummary:
        | {
            sourceLobbyTitle: string;
            reinviteAttempted: boolean;
            invitedCount: number;
            skippedCount: number;
          }
        | undefined;

      if (duplicateSourceLobby) {
        duplicationSummary = {
          sourceLobbyTitle: duplicateSourceLobby.title,
          reinviteAttempted: false,
          invitedCount: 0,
          skippedCount: 0,
        };
      }

      if (duplicateSourceLobby && accessType === 'locked' && invitePreviousParticipants) {
        const reinviteSummary = await reinviteLobbyParticipants(
          lobbyId,
          currentUserId,
          duplicateSourceLobby.players.map((player) => player.id),
        );
        duplicationSummary = {
          sourceLobbyTitle: duplicateSourceLobby.title,
          reinviteAttempted: true,
          invitedCount: reinviteSummary.invitedCount,
          skippedCount: reinviteSummary.skippedCount,
        };
      }

      navigate(`/lobby/${lobbyId}`, duplicationSummary ? { state: { duplicationSummary } } : undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create game');
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.create.title}</h1>
        <p className="text-gray-500 mt-1">
          {duplicateSourceLobby
            ? (lang === 'he' ? 'הלובי שוכפל עם אותן הגדרות. נשאר רק לבחור תאריך ושעה חדשים.' : 'This lobby was duplicated with the same settings. Only the new date and time are left.')
            : t.create.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {loadingDuplicateSource && (
          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            {lang === 'he' ? 'טוען את פרטי הלובי לשכפול...' : 'Loading the lobby details to duplicate...'}
          </div>
        )}

        {duplicateSourceLobby && (
          <Card>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {lang === 'he' ? 'שכפול מלובי היסטורי' : 'Duplicating from a past lobby'}
              </p>
              <p className="text-sm text-gray-600">
                {lang === 'he'
                  ? `הגדרות הלובי הועתקו מ-${duplicateSourceLobby.title}. התאריך והשעה אופסו כדי שתבחרו חדשים.`
                  : `The lobby settings were copied from ${duplicateSourceLobby.title}. The date and time were cleared so you can choose new ones.`}
              </p>
            </div>
          </Card>
        )}

        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'גישה ללובי' : 'Lobby access'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAccessType('open')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  accessType === 'open'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                {lang === 'he' ? 'פתוח' : 'Open'}
              </button>
              <button
                type="button"
                onClick={() => setAccessType('locked')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  accessType === 'locked'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {lang === 'he' ? 'נעול' : 'Locked'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {accessType === 'open'
                ? (lang === 'he' ? 'כל משתמש יכול לפתוח את הלובי ולהצטרף לפי הזמינות.' : 'Anyone can open the lobby and join if space is available.')
                : (lang === 'he' ? 'רק משתתפים, מוזמנים, או חברים של מי שכבר בפנים יוכלו להיכנס ללובי.' : 'Only participants, invited players, or friends of players already inside can access this lobby.')}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'סוג משחק' : 'Game type'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGameType('friendly')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  gameType === 'friendly'
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                }`}
              >
                {lang === 'he' ? '⚽ ידידותי' : '⚽ Friendly'}
              </button>
              <button
                type="button"
                onClick={() => setGameType('competitive')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  gameType === 'competitive'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                {lang === 'he' ? '🏆 תחרותי' : '🏆 Competitive'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {gameType === 'friendly'
                ? (lang === 'he' ? 'משחק ידידותי — ללא חלוקת נקודות תחרות' : 'Friendly game — no competitive points are awarded')
                : (lang === 'he' ? 'משחק תחרותי — בסיום מחולקות נקודות תחרות לפי תוצאת הקבוצות' : 'Competitive — competitive points are awarded after the result is submitted')}
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
          <Field label={lang === 'he' ? 'שם המשחק / הלובי' : 'Game / Lobby name'}>
            <Input
              placeholder={lang === 'he' ? 'למשל: משחק ערב בגורדון' : 'e.g. Evening game at Gordon'}
              value={form.title}
              onChange={setField('title')}
              required
            />
          </Field>
        </Card>

        <Card>
          <Field label={lang === 'he' ? 'מיקום המגרש' : 'Field location'}>
            <GooglePlacesAutocomplete
              value={locationDisplayValue}
              onSelect={(place) => {
                setSelectedPlace(place);
                setManualLocation({
                  address: place.address,
                  city: place.city,
                });
              }}
              onClear={() => setSelectedPlace(null)}
              placeholder={lang === 'he' ? 'חפש כתובת או עיר...' : 'Search address or city...'}
              required
            />
            {selectedPlace && <SelectedPlaceNotice place={selectedPlace} lang={lang} />}
            {selectedPlace && (
              <p className="hidden">
                ✓ {selectedPlace.city && `${selectedPlace.city} · `}{selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
              </p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
              <Input
                value={manualLocation.address}
                onChange={(event) => {
                  setSelectedPlace(null);
                  setManualLocation((prev) => ({ ...prev, address: event.target.value }));
                }}
                placeholder={lang === 'he' ? 'גיבוי ידני: כתובת' : 'Manual fallback: address'}
              />
              <Input
                value={manualLocation.city}
                onChange={(event) => {
                  setSelectedPlace(null);
                  setManualLocation((prev) => ({ ...prev, city: event.target.value }));
                }}
                placeholder={lang === 'he' ? 'גיבוי ידני: עיר' : 'Manual fallback: city'}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {lang === 'he'
                ? 'אם החיפוש לא מוצא את המיקום או שמפות לא נטענות, אפשר עדיין לפרסם לובי עם כתובת ועיר ידנית.'
                : 'If search does not find the location or Maps fails to load, you can still publish with a manual address and city.'}
            </p>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'מספר קבוצות' : 'Number of teams'}
            </label>
            <div className="flex gap-2">
              {TEAM_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, numTeams: count }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    form.numTeams === count
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {count} {lang === 'he' ? 'קבוצות' : 'teams'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                {lang === 'he' ? 'שחקנים לקבוצה' : 'Players per team'}
              </label>
              <span className="text-sm font-bold text-primary-600">{form.playersPerTeam}</span>
            </div>
            <input
              type="range"
              min="3"
              max="11"
              step="1"
              value={form.playersPerTeam}
              onChange={(event) => setForm((prev) => ({ ...prev, playersPerTeam: Number(event.target.value) }))}
              className="w-full accent-primary-600"
            />
          </div>

          <div className="bg-primary-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-primary-700 font-medium">
              {lang === 'he' ? 'סה"כ שחקנים מקסימלי:' : 'Total max players:'}
            </span>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'סוג מגרש (אופציונלי)' : 'Field type (optional)'}
            </label>
            <div className="flex gap-2">
              {([['grass', lang === 'he' ? '🌿 דשא' : '🌿 Grass'], ['asphalt', lang === 'he' ? '⬛ אספלט' : '⬛ Asphalt'], ['indoor', lang === 'he' ? '🏟️ אולם' : '🏟️ Indoor']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFieldType((prev) => prev === val ? '' : val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${fieldType === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'מגבלת מגדר' : 'Gender restriction'}
            </label>
            <div className="flex gap-2">
              {([['none', lang === 'he' ? 'כולם' : 'All'], ['male', lang === 'he' ? '👨 גברים' : '👨 Men only'], ['female', lang === 'he' ? '👩 נשים' : '👩 Women only']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGenderRestriction(val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${genderRestriction === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {lang === 'he' ? 'טווח גילאים (אופציונלי)' : 'Age range (optional)'}
            </label>
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
                ? 'רק שחקנים שתאריך הלידה שלהם מתאים לטווח יוכלו להצטרף.'
                : 'Only players whose birth date matches this range will be able to join.'}
            </p>
          </div>
        </Card>

        <Card>
          <Field label={t.create.description}>
            <textarea
              value={form.description}
              onChange={setField('description')}
              rows={3}
              placeholder={t.create.descriptionPlaceholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>
        </Card>

        {duplicateSourceLobby && accessType === 'locked' && (
          <Card>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={invitePreviousParticipants}
                onChange={(event) => setInvitePreviousParticipants(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-300"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {lang === 'he' ? 'להזמין מחדש את משתתפי הלובי הקודם' : 'Re-invite players from the previous lobby'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {lang === 'he'
                    ? 'אחרי הפרסום ננסה לשלוח invite מחדש למי שהיה בלובי הקודם, כל עוד אפשר להזמין אותו ללובי הנעול החדש.'
                    : 'After publishing, we will try to invite back players from the previous lobby as long as they are eligible for the new locked lobby.'}
                </p>
              </div>
            </label>
          </Card>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-base transition-colors shadow-md hover:shadow-lg"
        >
          {submitting ? (lang === 'he' ? 'מפרסם משחק...' : 'Publishing game...') : t.create.submit}
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
    <input
      {...props}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
    />
  );
}

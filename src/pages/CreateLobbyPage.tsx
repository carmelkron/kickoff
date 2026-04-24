import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { createLobby } from '../lib/appData';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { buildLobbyDateTime, validateCreateLobbyDraft } from '../lib/validation';
import type { FieldType, GameType, LobbyAccessType } from '../types';
import GooglePlacesAutocomplete, { type PlaceResult } from '../components/GooglePlacesAutocomplete';
import SelectedPlaceNotice from '../components/SelectedPlaceNotice';
import { formatLocationLabel } from '../utils/location';

const TEAM_OPTIONS = [2, 3, 4];

export default function CreateLobbyPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t, lang } = useLang();

  const [gameType, setGameType] = useState<GameType>('friendly');
  const [accessType, setAccessType] = useState<LobbyAccessType>('open');
  const [fieldType, setFieldType] = useState<FieldType | ''>('');
  const [showOptionalSettings, setShowOptionalSettings] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    numTeams: 2,
    playersPerTeam: 5,
    minPointsPerGame: '',
    price: '',
    description: '',
  });
  const [manualLocation, setManualLocation] = useState({
    address: '',
    city: '',
  });
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const currentUserId = currentUser.id;
  const maxPlayers = form.numTeams * form.playersPerTeam;
  const locationDisplayValue = selectedPlace
    ? formatLocationLabel(selectedPlace.address, selectedPlace.city)
    : formatLocationLabel(manualLocation.address, manualLocation.city);

  function setField(key: 'title' | 'date' | 'time' | 'minPointsPerGame' | 'price' | 'description') {
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
        price: numericPrice,
        description: form.description || undefined,
        createdBy: currentUserId,
        gameType,
        accessType,
        fieldType: fieldType || undefined,
        latitude: selectedPlace?.latitude,
        longitude: selectedPlace?.longitude,
      });

      navigate(`/lobby/${lobbyId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create game');
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.create.title}</h1>
        <p className="text-gray-500 mt-1">{t.create.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <div className="grid gap-5">
            <Field label={lang === 'he' ? 'גישה ללובי' : 'Lobby access'}>
              <SegmentedChoice<LobbyAccessType>
                value={accessType}
                options={[
                  { value: 'open', label: lang === 'he' ? 'פתוח' : 'Open' },
                  { value: 'locked', label: lang === 'he' ? 'נעול' : 'Locked' },
                ]}
                onChange={setAccessType}
              />
            </Field>

            <Field label={lang === 'he' ? 'סוג משחק' : 'Game type'}>
              <SegmentedChoice<GameType>
                value={gameType}
                options={[
                  { value: 'friendly', label: lang === 'he' ? 'ידידותי' : 'Friendly' },
                  { value: 'competitive', label: lang === 'he' ? 'תחרותי' : 'Competitive' },
                ]}
                onChange={setGameType}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <Field label={lang === 'he' ? 'שם הלובי' : 'Lobby name'}>
            <Input
              placeholder={lang === 'he' ? 'למשל: משחק ערב בגורדון' : 'e.g. Evening game at Gordon'}
              value={form.title}
              onChange={setField('title')}
              required
            />
          </Field>
        </Card>

        <Card>
          <Field label={lang === 'he' ? 'מיקום' : 'Location'}>
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
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
              <Input
                value={manualLocation.address}
                onChange={(event) => {
                  setSelectedPlace(null);
                  setManualLocation((prev) => ({ ...prev, address: event.target.value }));
                }}
                placeholder={lang === 'he' ? 'כתובת ידנית' : 'Manual address'}
              />
              <Input
                value={manualLocation.city}
                onChange={(event) => {
                  setSelectedPlace(null);
                  setManualLocation((prev) => ({ ...prev, city: event.target.value }));
                }}
                placeholder={lang === 'he' ? 'עיר ידנית' : 'Manual city'}
              />
            </div>
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

          <div className="rounded-xl bg-primary-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-primary-700 font-medium">
              {lang === 'he' ? 'סה"כ שחקנים מקסימלי' : 'Total max players'}
            </span>
            <span className="text-lg font-bold text-primary-700">{maxPlayers}</span>
          </div>
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setShowOptionalSettings((prev) => !prev)}
            className="flex w-full items-center justify-between text-start"
            aria-expanded={showOptionalSettings}
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {lang === 'he' ? 'הגדרות אופציונליות' : 'Optional settings'}
              </h2>
            </div>
            {showOptionalSettings ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
          </button>

          {showOptionalSettings && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <Field label={lang === 'he' ? 'סוג מגרש' : 'Field type'}>
                <SegmentedChoice<FieldType | ''>
                  value={fieldType}
                  options={[
                    { value: '', label: lang === 'he' ? 'לא הוגדר' : 'Not set' },
                    { value: 'grass', label: lang === 'he' ? 'דשא' : 'Grass' },
                    { value: 'asphalt', label: lang === 'he' ? 'אספלט' : 'Asphalt' },
                    { value: 'indoor', label: lang === 'he' ? 'אולם' : 'Indoor' },
                  ]}
                  onChange={setFieldType}
                />
              </Field>

              {gameType === 'competitive' && (
                <Field label={lang === 'he' ? 'מינימום נקודות למשחק' : 'Minimum points per game'}>
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
              )}

              <Field label={t.create.price}>
                <Input type="number" min="0" value={form.price} onChange={setField('price')} placeholder={t.create.pricePlaceholder} />
              </Field>

              <Field label={lang === 'he' ? 'תיאור' : 'Description'}>
                <textarea
                  value={form.description}
                  onChange={setField('description')}
                  rows={3}
                  placeholder={t.create.descriptionPlaceholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </Field>
            </div>
          )}
        </Card>

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

function SegmentedChoice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
            value === option.value
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { validateRegisterDraft } from '../lib/validation';
import GooglePlacesAutocomplete, { type PlaceResult } from '../components/GooglePlacesAutocomplete';
import SelectedPlaceNotice from '../components/SelectedPlaceNotice';
import { formatLocationLabel } from '../utils/location';

const AVATAR_COLORS = [
  { value: 'bg-blue-500', label: 'Blue' },
  { value: 'bg-red-500', label: 'Red' },
  { value: 'bg-green-600', label: 'Green' },
  { value: 'bg-purple-500', label: 'Purple' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-pink-500', label: 'Pink' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-indigo-500', label: 'Indigo' },
];

const POSITIONS_HE = ['שוער', 'הגנה', 'קישור', 'התקפה'];
const POSITIONS_EN = ['Goalkeeper', 'Defense', 'Midfield', 'Attack'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, currentUser } = useAuth();
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    position: '',
    bio: '',
    avatarColor: 'bg-blue-500',
    birthdate: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [homePlace, setHomePlace] = useState<PlaceResult | null>(null);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const positions = lang === 'he' ? POSITIONS_HE : POSITIONS_EN;

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function setField(key: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function getInitials(name: string) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.trim().slice(0, 2).toUpperCase() || '?';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const validationErrors = validateRegisterDraft({
      name: form.name,
      email: form.email,
      password: form.password,
      confirm: form.confirm,
      position: form.position,
      bio: form.bio,
      birthdate: form.birthdate,
      photoFile,
    });

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSubmitting(true);
    const nextError = await register({
      name: form.name,
      email: form.email,
      password: form.password,
      initials: getInitials(form.name),
      avatarColor: form.avatarColor,
      position: form.position,
      bio: form.bio || undefined,
      birthdate: form.birthdate || undefined,
      photoFile: photoFile ?? undefined,
      homeLatitude: homePlace?.latitude,
      homeLongitude: homePlace?.longitude,
      homeAddress: homePlace?.address,
    });

    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    navigate('/');
  }

  const preview = form.name ? getInitials(form.name) : '?';

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {lang === 'he' ? 'הצטרף ל-KickOff' : 'Join KickOff'}
        </h1>
        <p className="text-gray-500 mt-1">
          {lang === 'he' ? 'צור פרופיל ומצא משחקים קרובים' : 'Create a profile and find nearby games'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {lang === 'he' ? 'תמונת פרופיל' : 'Profile photo'}
          </label>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className={`w-16 h-16 rounded-full ${form.avatarColor} flex items-center justify-center text-white text-xl font-bold`}>
                  {preview}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -end-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <Camera size={13} className="text-gray-600" />
              </button>
            </div>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-primary-600 font-medium hover:underline mb-2 block"
              >
                {photoPreview
                  ? lang === 'he'
                    ? 'החלף תמונה'
                    : 'Change photo'
                  : lang === 'he'
                    ? 'העלה מהמכשיר'
                    : 'Upload from device'}
              </button>

              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      if (photoPreview) {
                        URL.revokeObjectURL(photoPreview);
                      }
                      setPhotoFile(null);
                      setPhotoPreview('');
                      setForm((prev) => ({ ...prev, avatarColor: color.value }));
                    }}
                    className={`w-6 h-6 rounded-full ${color.value} border-2 transition-all ${
                      form.avatarColor === color.value && !photoPreview ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <Field label={lang === 'he' ? 'שם מלא' : 'Full name'}>
            <Input value={form.name} onChange={setField('name')} placeholder={lang === 'he' ? 'ישראל ישראלי' : 'John Doe'} required />
          </Field>
          <Field label={lang === 'he' ? 'אימייל' : 'Email'}>
            <Input type="email" value={form.email} onChange={setField('email')} placeholder="you@example.com" required />
          </Field>
          <Field label={lang === 'he' ? 'סיסמה' : 'Password'}>
            <Input type="password" value={form.password} onChange={setField('password')} placeholder="••••••" required />
          </Field>
          <Field label={lang === 'he' ? 'אימות סיסמה' : 'Confirm password'}>
            <Input type="password" value={form.confirm} onChange={setField('confirm')} placeholder="••••••" required />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <Field label={lang === 'he' ? 'עמדה מועדפת' : 'Preferred position'}>
            <select
              value={form.position}
              onChange={setField('position')}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">{lang === 'he' ? 'בחר עמדה' : 'Select position'}</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </Field>
          <Field label={lang === 'he' ? 'תאריך לידה (אופציונלי)' : 'Birth date (optional)'}>
            <Input type="date" value={form.birthdate} onChange={setField('birthdate')} max="2099-12-31" />
            <p className="mt-1.5 text-xs text-gray-400">
              {lang === 'he'
                ? 'נשתמש בזה רק כדי לבדוק התאמה ללוביים עם הגבלת גיל.'
                : 'Used only to check age-restricted lobbies.'}
            </p>
          </Field>
          <Field label={lang === 'he' ? 'ביו קצר (אופציונלי)' : 'Short bio (optional)'}>
            <textarea
              rows={3}
              value={form.bio}
              onChange={setField('bio')}
              placeholder={lang === 'he' ? 'ספר קצת על עצמך...' : 'Tell us a bit about yourself...'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <Field label={lang === 'he' ? 'כתובת הבית שלך (אופציונלי)' : 'Your home address (optional)'}>
            <GooglePlacesAutocomplete
              value={homePlace ? formatLocationLabel(homePlace.address, homePlace.city) : ''}
              onSelect={setHomePlace}
              onClear={() => setHomePlace(null)}
              placeholder={lang === 'he' ? 'חפש את הכתובת שלך...' : 'Search your address...'}
            />
            {homePlace && <SelectedPlaceNotice place={homePlace} lang={lang} privacyNote />}
            <p className="text-xs text-gray-400 mt-1.5">
              {lang === 'he'
                ? '🔒 כתובתך פרטית לחלוטין — משמשת רק לחישוב מרחק למשחקים'
                : '🔒 Your address is private — used only to calculate distance to games'}
            </p>
          </Field>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-base transition-colors shadow-md"
        >
          {submitting ? (lang === 'he' ? 'יוצר פרופיל...' : 'Creating profile...') : lang === 'he' ? 'צור פרופיל' : 'Create Profile'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {lang === 'he' ? 'כבר יש לך חשבון? ' : 'Already have an account? '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            {lang === 'he' ? 'התחבר' : 'Log in'}
          </Link>
        </p>
      </form>
    </main>
  );
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

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { validateRegisterOptionalDraft, validateRegisterStepOneDraft } from '../lib/validation';
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

type StepOneFormState = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  position: string;
  avatarColor: string;
};

type StepTwoFormState = {
  bio: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    completeRequiredOnboarding,
    completeOptionalOnboarding,
    skipOptionalOnboarding,
    currentUser,
  } = useAuth();
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stepOne, setStepOne] = useState<StepOneFormState>({
    name: '',
    email: '',
    password: '',
    confirm: '',
    position: '',
    avatarColor: 'bg-blue-500',
  });
  const [stepTwo, setStepTwo] = useState<StepTwoFormState>({
    bio: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [homePlace, setHomePlace] = useState<PlaceResult | null>(null);

  const currentStep = currentUser?.onboardingStatus === 'pending_optional' ? 2 : 1;

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setStepOne((prev) => ({
      ...prev,
      name: currentUser.name ?? prev.name,
      email: currentUser.email ?? prev.email,
      position: currentUser.position ?? prev.position,
      avatarColor: currentUser.avatarColor ?? prev.avatarColor,
    }));
    setStepTwo((prev) => ({
      ...prev,
      bio: currentUser.bio ?? prev.bio,
    }));

    if (!photoPreview && currentUser.photoUrl) {
      setPhotoPreview(currentUser.photoUrl);
    }

    if (currentUser.homeAddress) {
      setHomePlace({
        address: currentUser.homeAddress,
        city: '',
        latitude: currentUser.homeLatitude ?? 0,
        longitude: currentUser.homeLongitude ?? 0,
        placeId: '',
      });
    }
  }, [currentUser, photoPreview]);

  useEffect(() => {
    return () => {
      if (photoFile && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoFile, photoPreview]);

  if (currentUser?.onboardingStatus === 'complete') {
    return <Navigate to="/" replace />;
  }

  const positions = lang === 'he' ? POSITIONS_HE : POSITIONS_EN;
  const preview = stepOne.name ? getInitials(stepOne.name) : '?';

  function setStepOneField(key: keyof StepOneFormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setStepOne((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  function setStepTwoField(key: keyof StepTwoFormState) {
    return (event: ChangeEvent<HTMLTextAreaElement>) => {
      setStepTwo((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleRequiredSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const validationErrors = validateRegisterStepOneDraft(
      {
        name: stepOne.name,
        email: stepOne.email,
        password: stepOne.password,
        confirm: stepOne.confirm,
        position: stepOne.position,
        photoFile,
      },
      {
        requirePassword: !currentUser,
        requirePosition: true,
      },
    );

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSubmitting(true);

    const payload = {
      name: stepOne.name,
      email: stepOne.email,
      initials: getInitials(stepOne.name),
      avatarColor: stepOne.avatarColor,
      position: stepOne.position,
      photoFile: photoFile ?? undefined,
    };

    const nextError = currentUser
      ? await completeRequiredOnboarding(payload)
      : await register({
          ...payload,
          password: stepOne.password,
        });

    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  async function handleOptionalSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const validationErrors = validateRegisterOptionalDraft({
      bio: stepTwo.bio,
    });

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSubmitting(true);
    const nextError = await completeOptionalOnboarding({
      bio: stepTwo.bio || undefined,
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

  async function handleSkipOptional() {
    setSubmitting(true);
    setError('');
    const nextError = await skipOptionalOnboarding();
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }

    navigate('/');
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-8 text-center">
        <span className="text-4xl">⚽</span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
          {lang === 'he' ? `שלב ${currentStep} מתוך 2` : `Step ${currentStep} of 2`}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          {currentStep === 1
            ? (lang === 'he' ? 'יוצרים את הפרופיל הבסיסי' : 'Create your core profile')
            : (lang === 'he' ? 'עוד כמה פרטים, אם בא לך' : 'A few optional details')}
        </h1>
      </div>

      {currentStep === 1 ? (
        <form onSubmit={handleRequiredSubmit} className="space-y-5">
          <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              {lang === 'he' ? 'תמונת פרופיל' : 'Profile photo'}
            </label>

            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full ${stepOne.avatarColor} text-xl font-bold text-white`}>
                    {preview}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -end-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm transition-colors hover:bg-gray-50"
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
                  className="mb-2 block text-sm font-medium text-primary-600 hover:underline"
                >
                  {photoPreview
                    ? (lang === 'he' ? 'החלף תמונה' : 'Change photo')
                    : (lang === 'he' ? 'העלה מהמכשיר' : 'Upload from device')}
                </button>

                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        if (photoPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(photoPreview);
                        }
                        setPhotoFile(null);
                        setPhotoPreview('');
                        setStepOne((prev) => ({ ...prev, avatarColor: color.value }));
                      }}
                      className={`h-6 w-6 rounded-full ${color.value} border-2 transition-all ${
                        stepOne.avatarColor === color.value && !photoFile ? 'scale-110 border-gray-800' : 'border-transparent'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <Field label={lang === 'he' ? 'שם מלא' : 'Full name'}>
              <Input
                value={stepOne.name}
                onChange={setStepOneField('name')}
                placeholder={lang === 'he' ? 'ישראל ישראלי' : 'John Doe'}
                required
              />
            </Field>

            <Field label={lang === 'he' ? 'אימייל' : 'Email'}>
              <Input
                type="email"
                value={stepOne.email}
                onChange={setStepOneField('email')}
                placeholder="you@example.com"
                required
              />
            </Field>

            {!currentUser ? (
              <>
                <Field label={lang === 'he' ? 'סיסמה' : 'Password'}>
                  <Input
                    type="password"
                    value={stepOne.password}
                    onChange={setStepOneField('password')}
                    placeholder="••••••"
                    required
                  />
                </Field>

                <Field label={lang === 'he' ? 'אימות סיסמה' : 'Confirm password'}>
                  <Input
                    type="password"
                    value={stepOne.confirm}
                    onChange={setStepOneField('confirm')}
                    placeholder="••••••"
                    required
                  />
                </Field>
              </>
            ) : null}

            <Field label={lang === 'he' ? 'עמדה' : 'Position'}>
              <select
                value={stepOne.position}
                onChange={setStepOneField('position')}
                required
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">{lang === 'he' ? 'בחר עמדה' : 'Select position'}</option>
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary-600 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? (lang === 'he' ? 'ממשיכים...' : 'Continuing...') : (lang === 'he' ? 'המשך' : 'Continue')}
          </button>

          {!currentUser ? (
            <p className="text-center text-sm text-gray-500">
              {lang === 'he' ? 'כבר יש לך חשבון? ' : 'Already have an account? '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                {lang === 'he' ? 'התחבר' : 'Log in'}
              </Link>
            </p>
          ) : null}
        </form>
      ) : (
        <form onSubmit={handleOptionalSubmit} className="space-y-5">
          <section className="space-y-4 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <Field label={lang === 'he' ? 'ביוגרפיה' : 'Bio'}>
              <textarea
                rows={4}
                value={stepTwo.bio}
                onChange={setStepTwoField('bio')}
                placeholder={lang === 'he' ? 'ספר קצת על עצמך...' : 'Tell us a bit about yourself...'}
                className="w-full resize-none rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </Field>

            <Field label={lang === 'he' ? 'כתובת בית' : 'Home address'}>
              <GooglePlacesAutocomplete
                value={homePlace ? formatLocationLabel(homePlace.address, homePlace.city) : ''}
                onSelect={setHomePlace}
                onClear={() => setHomePlace(null)}
                placeholder={lang === 'he' ? 'חפש את הכתובת שלך...' : 'Search your address...'}
              />
              {homePlace ? <SelectedPlaceNotice place={homePlace} lang={lang} privacyNote /> : null}
            </Field>
          </section>

          {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSkipOptional()}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-gray-200 bg-white py-4 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {lang === 'he' ? 'דלג' : 'Skip'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-primary-600 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? (lang === 'he' ? 'שומר...' : 'Saving...') : (lang === 'he' ? 'שמור וסיים' : 'Save and finish')}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-gray-200 px-3 py-3 text-gray-800 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-300 ${props.className ?? ''}`.trim()}
    />
  );
}

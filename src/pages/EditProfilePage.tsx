import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useLang } from '../contexts/LanguageContext';
import { updateProfile, updateHomeLocation } from '../lib/appData';
import { getProfileSkillBadgeStyle } from '../lib/profileSkillBadges';
import { uploadAvatar } from '../lib/storage';
import type { Gender } from '../types';
import { MAX_PROFILE_SKILLS, sanitizeProfileSkills, validateProfileSkills } from '../lib/validation';
import { validateBirthdate } from '../utils/age';
import GooglePlacesAutocomplete, { type PlaceResult } from '../components/GooglePlacesAutocomplete';
import SelectedPlaceNotice from '../components/SelectedPlaceNotice';
import { formatLocationLabel } from '../utils/location';

const POSITIONS_HE = ['שוער', 'הגנה', 'קישור', 'התקפה'];
const POSITIONS_EN = ['Goalkeeper', 'Defense', 'Midfield', 'Attack'];

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { currentUser, refreshCurrentUser } = useAuth();
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    position: '',
    bio: '',
    gender: '' as Gender | '',
    birthdate: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [homePlace, setHomePlace] = useState<PlaceResult | null>(null);

  useEffect(() => {
    if (currentUser) {
      setForm({
        name: currentUser.name,
        position: currentUser.position ?? '',
        bio: currentUser.bio ?? '',
        gender: currentUser.gender ?? '',
        birthdate: currentUser.birthdate ?? '',
      });
      setSkills(currentUser.skills?.map((skill) => skill.label) ?? []);
      setSkillInput('');
      // Pre-fill home address if already set
      if (currentUser.homeAddress) {
        setHomePlace({
          address: currentUser.homeAddress,
          city: '',
          latitude: currentUser.homeLatitude ?? 0,
          longitude: currentUser.homeLongitude ?? 0,
          placeId: '',
        });
      }
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  if (!currentUser) return <Navigate to="/login" replace />;

  const positions = lang === 'he' ? POSITIONS_HE : POSITIONS_EN;

  function setField(key: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function addSkill(nextSkill = skillInput) {
    const normalized = sanitizeProfileSkills([...skills, nextSkill]);
    if (normalized.length === skills.length) {
      setSkillInput('');
      return;
    }

    setSkills(normalized.slice(0, MAX_PROFILE_SKILLS));
    setSkillInput('');
  }

  function removeSkill(skillLabel: string) {
    setSkills((prev) => prev.filter((skill) => skill !== skillLabel));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError(lang === 'he' ? 'שם חייב להכיל לפחות 2 תווים' : 'Name must be at least 2 characters');
      return;
    }
    if (!form.position) {
      setError(lang === 'he' ? 'בחר עמדה מועדפת' : 'Choose a preferred position');
      return;
    }
    const birthdateError = validateBirthdate(form.birthdate);
    if (birthdateError) {
      setError(birthdateError);
      return;
    }
    const skillErrors = validateProfileSkills(skills);
    if (skillErrors.length > 0) {
      setError(skillErrors[0]);
      return;
    }
    setSubmitting(true);
    setError('');

    if (!currentUser) return;
    const userId = currentUser.id;
    try {
      let photoUrl: string | null | undefined = undefined;
      if (photoFile) {
        photoUrl = await uploadAvatar(photoFile, userId);
      }

      await updateProfile({
        profileId: userId,
        name: form.name.trim(),
        position: form.position,
        bio: form.bio || undefined,
        gender: form.gender || undefined,
        birthdate: form.birthdate || null,
        photoUrl,
        skills,
      });

      await updateHomeLocation(
        userId,
        homePlace?.latitude ?? null,
        homePlace?.longitude ?? null,
        homePlace?.address ?? null,
      );

      await refreshCurrentUser();
      navigate(`/profile/${userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      setSubmitting(false);
    }
  }

  const currentPhotoUrl = photoPreview || currentUser.photoUrl || '';

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors">
        <ChevronLeft size={16} />
        {lang === 'he' ? 'חזרה' : 'Back'}
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{lang === 'he' ? 'עריכת פרופיל' : 'Edit profile'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">{lang === 'he' ? 'תמונת פרופיל' : 'Profile photo'}</label>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {currentPhotoUrl ? (
                <img src={currentPhotoUrl} alt="preview" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className={`w-16 h-16 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white text-xl font-bold`}>
                  {currentUser.initials}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -end-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50 transition-colors">
                <Camera size={13} className="text-gray-600" />
              </button>
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-primary-600 font-medium hover:underline">
                {photoPreview ? (lang === 'he' ? 'החלף תמונה' : 'Change photo') : (lang === 'he' ? 'העלה תמונה' : 'Upload photo')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <Field label={lang === 'he' ? 'שם מלא' : 'Full name'}>
            <Input value={form.name} onChange={setField('name')} required />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <Field label={lang === 'he' ? 'מגדר (אופציונלי)' : 'Gender (optional)'}>
            <div className="flex gap-2">
              {([['male', lang === 'he' ? '👨 זכר' : '👨 Male'], ['female', lang === 'he' ? '👩 נקבה' : '👩 Female'], ['other', lang === 'he' ? '⚧ אחר' : '⚧ Other']] as const).map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gender: prev.gender === val ? '' : val }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${form.gender === val ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={lang === 'he' ? 'עמדה מועדפת' : 'Preferred position'}>
            <select value={form.position} onChange={setField('position')}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">{lang === 'he' ? 'בחר עמדה' : 'Select position'}</option>
              {positions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label={lang === 'he' ? 'תאריך לידה (אופציונלי)' : 'Birth date (optional)'}>
            <Input type="date" value={form.birthdate} onChange={setField('birthdate')} max="2099-12-31" />
            <p className="mt-1.5 text-xs text-gray-400">
              {lang === 'he'
                ? 'השדה הזה פרטי ומשמש רק לבדיקת התאמה ללוביים עם הגבלת גיל.'
                : 'This stays private and is used only for age-restricted lobbies.'}
            </p>
          </Field>
          <Field label={lang === 'he' ? 'ביו (אופציונלי)' : 'Bio (optional)'}>
            <textarea rows={3} value={form.bio} onChange={setField('bio')}
              placeholder={lang === 'he' ? 'ספר קצת על עצמך...' : 'Tell us about yourself...'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </Field>
          <Field label={lang === 'he' ? 'Skills / מיומנויות' : 'Skills'}>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                placeholder={lang === 'he' ? 'למשל: סיומת, דריבל, 1 על 1' : 'e.g. Finishing, Dribbling, 1v1 defense'}
                disabled={skills.length >= MAX_PROFILE_SKILLS}
              />
              <button
                type="button"
                onClick={() => addSkill()}
                disabled={!skillInput.trim() || skills.length >= MAX_PROFILE_SKILLS}
                className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {lang === 'he' ? 'הוסף' : 'Add'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {lang === 'he'
                ? `אפשר להוסיף עד ${MAX_PROFILE_SKILLS} מיומנויות. מבקרים בפרופיל יוכלו לעשות להן לייק.`
                : `Add up to ${MAX_PROFILE_SKILLS} skills. Profile visitors will be able to like them.`}
            </p>
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {skills.map((skill) => {
                  const badgeStyle = getProfileSkillBadgeStyle(skill);

                  return (
                    <span
                      key={skill}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium shadow-sm ${badgeStyle.chipClassName}`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-base">
                        {badgeStyle.icon}
                      </span>
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="rounded-full bg-white/70 px-1.5 py-0.5 text-sm text-transparent transition-colors hover:bg-white"
                      >
                        <span className="text-gray-700">&times;</span>
                      ×
                    </button>
                    </span>
                  );
                })}
              </div>
            )}
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
                ? '🔒 כתובתך פרטית — משמשת רק לחישוב מרחק למשחקים'
                : '🔒 Your address is private — used only to calculate distance to games'}
            </p>
          </Field>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-base transition-colors shadow-md">
          {submitting ? (lang === 'he' ? 'שומר...' : 'Saving...') : (lang === 'he' ? 'שמור שינויים' : 'Save changes')}
        </button>
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
    <input {...props} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent" />
  );
}

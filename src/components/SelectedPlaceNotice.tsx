import { MapPin } from 'lucide-react';
import type { PlaceResult } from './GooglePlacesAutocomplete';
import { formatLocationLabel } from '../utils/location';

type Props = {
  place: PlaceResult;
  lang: 'he' | 'en';
  privacyNote?: boolean;
};

export default function SelectedPlaceNotice({ place, lang, privacyNote = false }: Props) {
  const title = lang === 'he' ? 'המיקום שנבחר' : 'Selected location';
  const privacyText = lang === 'he'
    ? 'הכתובת פרטית ומשמשת רק לחישוב מרחקים.'
    : 'This address stays private and is only used for distance calculations.';
  const primaryText = formatLocationLabel(place.address, place.city);

  return (
    <div className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <MapPin size={15} className="mt-0.5 shrink-0 text-green-600" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-green-700">{title}</p>
          <p className="text-sm font-medium text-green-900 break-words">
            {primaryText}
          </p>
          {privacyNote && (
            <p className="text-xs text-green-700 mt-1">{privacyText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

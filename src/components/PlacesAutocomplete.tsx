import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';

export type PlaceResult = {
  displayText: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  placeId: string;
};

type Props = {
  value: string;
  onSelect: (place: PlaceResult) => void;
  onClear: () => void;
  placeholder?: string;
  required?: boolean;
};

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Singleton — load the script once for the whole app lifetime
let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (!API_KEY) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));

  // Already fully loaded
  if (window.google?.maps?.places) return Promise.resolve();

  // Already in progress
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const cbName = `__gmcb_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=iw&region=IL&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

export default function PlacesAutocomplete({ value, onSelect, onClear, placeholder, required }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const dummyRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keep input in sync when parent clears the value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Load Google Maps script on mount
  useEffect(() => {
    if (!API_KEY) return;
    loadGoogleMaps()
      .then(() => {
        autocompleteRef.current = new google.maps.places.AutocompleteService();
        if (dummyRef.current) {
          placesRef.current = new google.maps.places.PlacesService(dummyRef.current);
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load maps');
      });
  }, []);

  // PlacesService needs a real DOM node — init once dummyRef is available
  useEffect(() => {
    if (ready && dummyRef.current && !placesRef.current) {
      placesRef.current = new google.maps.places.PlacesService(dummyRef.current);
    }
  }, [ready]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function search(text: string) {
    if (!ready || !autocompleteRef.current || !text.trim()) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      autocompleteRef.current!.getPlacePredictions(
        { input: text, componentRestrictions: { country: 'il' } },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
            setPredictions(results);
            setOpen(true);
          } else {
            setPredictions([]);
            setOpen(false);
          }
        },
      );
    }, 300);
  }

  function selectPrediction(pred: google.maps.places.AutocompletePrediction) {
    if (!placesRef.current) return;
    setInputValue(pred.description);
    setOpen(false);
    setPredictions([]);

    placesRef.current.getDetails(
      { placeId: pred.place_id, fields: ['formatted_address', 'geometry', 'address_components'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
        const cityComp = place.address_components?.find(
          (c) => c.types.includes('locality') || c.types.includes('administrative_area_level_2'),
        );
        onSelect({
          displayText: pred.description,
          address: place.formatted_address ?? pred.description,
          city: cityComp?.long_name ?? '',
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          placeId: pred.place_id,
        });
      },
    );
  }

  // No API key — show plain input with warning
  if (!API_KEY) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) =>
            onSelect({ displayText: e.target.value, address: e.target.value, city: '', latitude: 0, longitude: 0, placeId: '' })
          }
          placeholder={placeholder}
          required={required}
          className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
        />
        <p className="text-xs text-amber-600 mt-1">
          ⚠ הוסף <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> ל-.env.local
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* PlacesService requires a DOM element — hidden div */}
      <div ref={dummyRef} className="hidden" />

      <div className="relative">
        <MapPin size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            search(e.target.value);
          }}
          placeholder={
            loadError ? '⚠ שגיאת טעינה' : ready ? placeholder : 'טוען מפות...'
          }
          required={required}
          autoComplete="off"
          className={`w-full ps-9 pe-8 border rounded-xl py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
            loadError ? 'border-red-200 focus:ring-red-300 bg-red-50' : 'border-gray-200 focus:ring-primary-300'
          }`}
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setPredictions([]);
              setOpen(false);
              onClear();
            }}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loadError && <p className="text-xs text-red-500 mt-1">{loadError}</p>}

      {open && predictions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((pred) => (
            <li
              key={pred.place_id}
              onMouseDown={() => selectPrediction(pred)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-primary-50 cursor-pointer border-b border-gray-50 last:border-0 first:rounded-t-xl last:rounded-b-xl"
            >
              <MapPin size={13} className="text-primary-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">
                  {pred.structured_formatting.main_text}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {pred.structured_formatting.secondary_text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { formatLocationLabel, stripCountrySuffix } from '../utils/location';

export type PlaceResult = {
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

type PredictionOption =
  | {
      key: string;
      displayText: string;
      mainText: string;
      secondaryText: string;
      source: 'new';
      placePrediction: google.maps.places.PlacePrediction;
    }
  | {
      key: string;
      displayText: string;
      mainText: string;
      secondaryText: string;
      source: 'legacy';
      prediction: google.maps.places.AutocompletePrediction;
    };

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-script';
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 10000;

let mapsLoadPromise: Promise<void> | null = null;

function findNewAddressComponent(
  components: google.maps.AddressComponent[] | undefined,
  ...types: string[]
) {
  return components?.find((component) => types.some((type) => component.types.includes(type)));
}

function findLegacyAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  ...types: string[]
) {
  return components?.find((component) => types.some((type) => component.types.includes(type)));
}

function buildAddressFromFormattedAddress(formattedAddress: string | undefined, city: string) {
  const cleaned = stripCountrySuffix(formattedAddress ?? '');
  const firstSegment = cleaned.split(',')[0]?.trim() ?? '';

  if (!firstSegment) {
    return city;
  }

  if (city && firstSegment.toLocaleLowerCase() === city.toLocaleLowerCase()) {
    return city;
  }

  return firstSegment;
}

function buildAddressFromNewPlace(
  formattedAddress: string | undefined,
  components: google.maps.AddressComponent[] | undefined,
  city: string,
) {
  const route = findNewAddressComponent(components, 'route')?.longText ?? '';
  const streetNumber = findNewAddressComponent(components, 'street_number')?.longText ?? '';
  const streetAddress = [route, streetNumber].filter(Boolean).join(' ').trim();

  if (streetAddress) {
    return streetAddress;
  }

  const neighborhood = findNewAddressComponent(components, 'neighborhood', 'sublocality', 'sublocality_level_1')?.longText ?? '';
  if (neighborhood && neighborhood.toLocaleLowerCase() !== city.toLocaleLowerCase()) {
    return neighborhood;
  }

  return buildAddressFromFormattedAddress(formattedAddress, city);
}

function buildAddressFromLegacyPlace(
  formattedAddress: string | undefined,
  components: google.maps.GeocoderAddressComponent[] | undefined,
  city: string,
) {
  const route = findLegacyAddressComponent(components, 'route')?.long_name ?? '';
  const streetNumber = findLegacyAddressComponent(components, 'street_number')?.long_name ?? '';
  const streetAddress = [route, streetNumber].filter(Boolean).join(' ').trim();

  if (streetAddress) {
    return streetAddress;
  }

  const neighborhood = findLegacyAddressComponent(components, 'neighborhood', 'sublocality', 'sublocality_level_1')?.long_name ?? '';
  if (neighborhood && neighborhood.toLocaleLowerCase() !== city.toLocaleLowerCase()) {
    return neighborhood;
  }

  return buildAddressFromFormattedAddress(formattedAddress, city);
}

function loadGoogleMaps(): Promise<void> {
  if (!API_KEY) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }

  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const cbName = `__gmcb_${Date.now()}`;
    const windowWithGoogle = window as unknown as Window & {
      [key: string]: unknown;
      gm_authFailure?: () => void;
    };
    const previousAuthFailure = windowWithGoogle.gm_authFailure;
    let settled = false;

    const cleanup = () => {
      delete windowWithGoogle[cbName];
      if (windowWithGoogle.gm_authFailure === handleAuthFailure) {
        if (previousAuthFailure) {
          windowWithGoogle.gm_authFailure = previousAuthFailure;
        } else {
          delete windowWithGoogle.gm_authFailure;
        }
      }
      window.clearTimeout(timeoutId);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        mapsLoadPromise = null;
        reject(error);
        return;
      }
      resolve();
    };

    const handleAuthFailure = () => {
      finish(new Error('Google Maps rejected the API key. Check the key and allowed referrers in Google Cloud.'));
    };

    const handleScriptError = () => {
      finish(new Error('Failed to load Google Maps. Check the API key and enabled APIs.'));
    };

    const timeoutId = window.setTimeout(() => {
      finish(new Error('Google Maps did not finish loading. Check the API key, enabled APIs, and Vercel environment variables.'));
    }, GOOGLE_MAPS_LOAD_TIMEOUT_MS);

    windowWithGoogle[cbName] = () => finish();
    windowWithGoogle.gm_authFailure = handleAuthFailure;

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('error', handleScriptError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=iw&region=IL&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.addEventListener('error', handleScriptError, { once: true });
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

export default function GooglePlacesAutocomplete({ value, onSelect, onClear, placeholder, required }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PredictionOption[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [noResults, setNoResults] = useState(false);

  const supportsNewAutocompleteRef = useRef(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const dummyRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!API_KEY) return;

    loadGoogleMaps()
      .then(async () => {
        if (typeof google.maps.importLibrary === 'function') {
          await google.maps.importLibrary('places');
        }

        supportsNewAutocompleteRef.current = Boolean(google.maps.places.AutocompleteSuggestion);
        if (supportsNewAutocompleteRef.current && google.maps.places.AutocompleteSessionToken) {
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }

        if (google.maps.places.AutocompleteService) {
          autocompleteRef.current = new google.maps.places.AutocompleteService();
        }
        if (dummyRef.current) {
          placesRef.current = new google.maps.places.PlacesService(dummyRef.current);
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load maps');
      });
  }, []);

  useEffect(() => {
    if (ready && dummyRef.current && !placesRef.current) {
      placesRef.current = new google.maps.places.PlacesService(dummyRef.current);
    }
  }, [ready]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
    };
  }, []);

  function mapPlacesStatusToMessage(status: google.maps.places.PlacesServiceStatus) {
    switch (status) {
      case google.maps.places.PlacesServiceStatus.REQUEST_DENIED:
        return 'Google Places request was denied. Check API key restrictions and enabled APIs.';
      case google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
        return 'Google Places quota was exceeded for this API key.';
      case google.maps.places.PlacesServiceStatus.INVALID_REQUEST:
        return 'Google Places rejected the request. Try a more specific address.';
      case google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR:
        return 'Google Places returned a temporary error. Please try again.';
      default:
        return '';
    }
  }

  function createNewSessionToken() {
    if (google.maps.places.AutocompleteSessionToken) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }

  function buildNewPredictionOptions(
    suggestions: google.maps.places.AutocompleteSuggestion[],
  ): PredictionOption[] {
    return suggestions
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction))
      .map((prediction) => ({
        key: prediction.placeId,
        displayText: prediction.text.text,
        mainText: prediction.mainText?.text ?? prediction.text.text,
        secondaryText: prediction.secondaryText?.text ?? '',
        source: 'new',
        placePrediction: prediction,
      }));
  }

  function buildLegacyPredictionOptions(
    results: google.maps.places.AutocompletePrediction[],
  ): PredictionOption[] {
    return results.map((prediction) => ({
      key: prediction.place_id,
      displayText: prediction.description,
      mainText: prediction.structured_formatting.main_text,
      secondaryText: prediction.structured_formatting.secondary_text ?? '',
      source: 'legacy',
      prediction,
    }));
  }

  function runPredictionRequest(
    request: google.maps.places.AutocompletionRequest,
    callback: google.maps.places.AutocompletePredictionsCallback,
  ) {
    autocompleteRef.current?.getPlacePredictions(request, callback);
  }

  async function runNewAutocomplete(text: string) {
    const requestBase: google.maps.places.AutocompleteRequest = {
      input: text,
      language: 'iw',
      region: 'il',
      sessionToken: sessionTokenRef.current ?? undefined,
    };

    const tryRestricted = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      ...requestBase,
      includedRegionCodes: ['il'],
    });

    if (tryRestricted.suggestions.length > 0) {
      return tryRestricted.suggestions;
    }

    const tryUnrestricted = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(requestBase);
    return tryUnrestricted.suggestions;
  }

  function search(text: string) {
    if (!ready || !text.trim()) {
      setPredictions([]);
      setOpen(false);
      setLoadError('');
      setNoResults(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (supportsNewAutocompleteRef.current && google.maps.places.AutocompleteSuggestion) {
        void runNewAutocomplete(text)
          .then((suggestions) => {
            const nextPredictions = buildNewPredictionOptions(suggestions);
            if (nextPredictions.length > 0) {
              setLoadError('');
              setNoResults(false);
              setPredictions(nextPredictions);
              setOpen(true);
              return;
            }

            setLoadError('');
            setNoResults(text.trim().length >= 2);
            setPredictions([]);
            setOpen(false);
          })
          .catch((error: unknown) => {
            setNoResults(false);
            setPredictions([]);
            setOpen(false);
            setLoadError(error instanceof Error ? error.message : 'Google Places request failed.');
          });
        return;
      }

      if (!autocompleteRef.current) {
        setLoadError('Google Places autocomplete is unavailable for this API project.');
        setNoResults(false);
        setPredictions([]);
        setOpen(false);
        return;
      }

      const handleResults = (
        results: google.maps.places.AutocompletePrediction[] | null,
        status: google.maps.places.PlacesServiceStatus,
      ) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          setLoadError('');
          setNoResults(false);
          setPredictions(buildLegacyPredictionOptions(results));
          setOpen(true);
          return;
        }

        if (
          status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS ||
          (status === google.maps.places.PlacesServiceStatus.OK && !results?.length)
        ) {
          setLoadError('');
          setNoResults(text.trim().length >= 2);
          setPredictions([]);
          setOpen(false);
          return;
        }

        const statusMessage = mapPlacesStatusToMessage(status);
        if (statusMessage) {
          setLoadError(statusMessage);
        }
        setNoResults(false);
        setPredictions([]);
        setOpen(false);
      };

      runPredictionRequest(
        { input: text, componentRestrictions: { country: 'il' } },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
            handleResults(results, status);
            return;
          }

          if (
            status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS ||
            (status === google.maps.places.PlacesServiceStatus.OK && !results?.length)
          ) {
            runPredictionRequest({ input: text }, handleResults);
            return;
          }

          handleResults(results, status);
        },
      );
    }, 300);
  }

  async function selectPrediction(prediction: PredictionOption) {
    setOpen(false);
    setPredictions([]);

    if (prediction.source === 'new') {
      try {
        const place = prediction.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        });

        if (!place.location) {
          setLoadError('Google Places returned a place without coordinates.');
          return;
        }

        const cityComp = place.addressComponents?.find(
          (component) =>
            component.types.includes('locality') || component.types.includes('administrative_area_level_2'),
        );
        const city = cityComp?.longText ?? '';
        const address = buildAddressFromNewPlace(place.formattedAddress, place.addressComponents, city);

        setLoadError('');
        setNoResults(false);
        setInputValue(formatLocationLabel(address, city));
        onSelect({
          address,
          city,
          latitude: place.location.lat(),
          longitude: place.location.lng(),
          placeId: prediction.placePrediction.placeId,
        });
        createNewSessionToken();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to fetch place details.');
      }
      return;
    }

    if (!placesRef.current) return;

    placesRef.current.getDetails(
      { placeId: prediction.prediction.place_id, fields: ['formatted_address', 'geometry', 'address_components'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          const statusMessage = mapPlacesStatusToMessage(status);
          if (statusMessage) {
            setLoadError(statusMessage);
          }
          return;
        }

        setLoadError('');
        setNoResults(false);
        const cityComp = place.address_components?.find(
          (component) =>
            component.types.includes('locality') || component.types.includes('administrative_area_level_2'),
        );
        const city = cityComp?.long_name ?? '';
        const address = buildAddressFromLegacyPlace(place.formatted_address, place.address_components, city);

        setInputValue(formatLocationLabel(address, city));
        onSelect({
          address,
          city,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          placeId: prediction.prediction.place_id,
        });
      },
    );
  }

  if (!API_KEY) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) =>
            onSelect({
              address: e.target.value,
              city: '',
              latitude: 0,
              longitude: 0,
              placeId: '',
            })
          }
          placeholder={placeholder}
          required={required}
          className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
        />
        <p className="text-xs text-amber-600 mt-1">
          Add <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code>, <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>, or <code className="bg-amber-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code> in Vercel or your local env file.
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div ref={dummyRef} className="hidden" />

      <div className="relative">
        <MapPin size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (loadError) {
              setLoadError('');
            }
            if (noResults) {
              setNoResults(false);
            }
            search(e.target.value);
          }}
          placeholder={loadError ? 'Unable to load places' : ready ? placeholder : 'Loading places...'}
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
              setNoResults(false);
              onClear();
            }}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loadError && <p className="text-xs text-red-500 mt-1">{loadError}</p>}
      {!loadError && noResults && (
        <p className="text-xs text-gray-500 mt-1">No matching places found yet. Try a fuller address or city name.</p>
      )}

      {open && predictions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((pred) => (
            <li
              key={pred.key}
              onMouseDown={() => selectPrediction(pred)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-primary-50 cursor-pointer border-b border-gray-50 last:border-0 first:rounded-t-xl last:rounded-b-xl"
            >
              <MapPin size={13} className="text-primary-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">
                  {pred.mainText}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {pred.secondaryText}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

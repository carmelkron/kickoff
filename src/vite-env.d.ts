/// <reference types="vite/client" />

declare namespace google.maps {
  function importLibrary(name: 'places'): Promise<PlacesLibrary>;

  interface PlacesLibrary {
    AutocompleteService?: typeof google.maps.places.AutocompleteService;
    AutocompleteSessionToken?: typeof google.maps.places.AutocompleteSessionToken;
    AutocompleteSuggestion?: typeof google.maps.places.AutocompleteSuggestion;
    PlacesService?: typeof google.maps.places.PlacesService;
  }

  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  interface AddressComponent {
    longText: string;
    shortText: string;
    types: string[];
  }

  namespace places {
    interface AutocompletePrediction {
      description: string;
      place_id: string;
      structured_formatting: {
        main_text: string;
        secondary_text?: string;
      };
    }

    interface AutocompletionRequest {
      input: string;
      componentRestrictions?: {
        country: string | string[];
      };
    }

    interface AutocompleteRequest {
      input: string;
      includedRegionCodes?: string[];
      language?: string;
      region?: string;
      sessionToken?: AutocompleteSessionToken;
    }

    interface PlaceGeometry {
      location?: google.maps.LatLng;
    }

    interface PlaceResult {
      formatted_address?: string;
      geometry?: PlaceGeometry;
      address_components?: google.maps.GeocoderAddressComponent[];
    }

    interface PlaceDetailsRequest {
      placeId: string;
      fields: string[];
    }

    interface FormattableText {
      text: string;
    }

    type AutocompletePredictionsCallback = (
      predictions: AutocompletePrediction[] | null,
      status: PlacesServiceStatus,
    ) => void;

    type PlaceDetailsCallback = (
      place: PlaceResult | null,
      status: PlacesServiceStatus,
    ) => void;

    class AutocompleteSessionToken {}

    class AutocompleteService {
      getPlacePredictions(
        request: AutocompletionRequest,
        callback: AutocompletePredictionsCallback,
      ): void;
    }

    class PlacesService {
      constructor(attrContainer: Element);
      getDetails(request: PlaceDetailsRequest, callback: PlaceDetailsCallback): void;
    }

    class Place {
      formattedAddress?: string;
      location?: google.maps.LatLng;
      addressComponents?: google.maps.AddressComponent[];
      fetchFields(options: { fields: string[] }): Promise<{ place: Place }>;
    }

    class PlacePrediction {
      placeId: string;
      text: FormattableText;
      mainText?: FormattableText;
      secondaryText?: FormattableText;
      toPlace(): Place;
    }

    class AutocompleteSuggestion {
      placePrediction?: PlacePrediction;
      static fetchAutocompleteSuggestions(
        request: AutocompleteRequest,
      ): Promise<{ suggestions: AutocompleteSuggestion[] }>;
    }

    enum PlacesServiceStatus {
      INVALID_REQUEST = 'INVALID_REQUEST',
      NOT_FOUND = 'NOT_FOUND',
      OK = 'OK',
      OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
      REQUEST_DENIED = 'REQUEST_DENIED',
      UNKNOWN_ERROR = 'UNKNOWN_ERROR',
      ZERO_RESULTS = 'ZERO_RESULTS',
    }
  }
}

interface Window {
  google?: typeof google;
  gm_authFailure?: () => void;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

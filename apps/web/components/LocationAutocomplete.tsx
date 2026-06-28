'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ProfileLocation } from '@/lib/types';

interface LocationAutocompleteProps {
  value: ProfileLocation | null;
  onChange: (location: ProfileLocation | null) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}

// Extend window for Google Maps types
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: google.maps.places.AutocompleteOptions
          ) => google.maps.places.Autocomplete;
        };
      };
    };
    initGoogleMapsCallback?: () => void;
  }
}

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set');
    return Promise.reject(new Error('Google Maps API key not configured'));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;

    window.initGoogleMapsCallback = () => {
      resolve();
      delete window.initGoogleMapsCallback;
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps'));
      googleMapsPromise = null;
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing a city...',
  label,
  id,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(value?.displayName ?? '');
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value?.displayName ?? '');
  }, [value]);

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    let mounted = true;

    loadGoogleMapsScript()
      .then(() => {
        if (!mounted || !inputRef.current || !window.google) return;

        setIsLoaded(true);

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['(cities)'],
          componentRestrictions: { country: 'gb' },
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place?.place_id || !place.geometry?.location) return;

          const location: ProfileLocation = {
            placeId: place.place_id,
            displayName: place.name || place.formatted_address || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };

          onChange(location);
          setInputValue(location.displayName);
        });
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
      });

    return () => {
      mounted = false;
    };
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    // If user clears the input manually, clear the location
    if (!e.target.value.trim()) {
      onChange(null);
    }
  }, [onChange]);

  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-white/15 bg-[var(--color-bg-primary)] px-4 py-2.5 pr-10 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-accent)]"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear location"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {!isLoaded && !value && (
        <p className="mt-1 text-xs text-white/40">Loading location search...</p>
      )}
    </div>
  );
}

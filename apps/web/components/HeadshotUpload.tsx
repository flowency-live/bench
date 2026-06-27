'use client';

import { useState, useRef, useCallback } from 'react';
import { ImageCropper } from './ImageCropper';

interface Props {
  currentUrl: string | null;
  profileId: string;
  onUploadComplete: (url: string) => void;
}

type UploadState = 'idle' | 'selecting' | 'cropping' | 'uploading' | 'error';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function HeadshotUpload({ currentUrl, profileId, onUploadComplete }: Props) {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      setState('error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      setState('error');
      return;
    }

    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setState('cropping');
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setState('error');
    };
    reader.readAsDataURL(file);

    // Reset input for re-selection
    e.target.value = '';
  }, []);

  const handleCropComplete = async (croppedBlob: Blob) => {
    setState('uploading');
    setError(null);

    try {
      // Upload via server-side API route (bypasses CORS)
      const formData = new FormData();
      formData.append('file', croppedBlob, 'headshot.jpg');
      formData.append('profileId', profileId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { assetUrl } = await response.json();

      // Notify parent of successful upload
      onUploadComplete(assetUrl);
      setState('idle');
      setSelectedImage(null);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image. Please try again.');
      setState('error');
    }
  };

  const handleCropCancel = () => {
    setSelectedImage(null);
    setState('idle');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Preview and upload button */}
      <div className="flex items-center gap-4">
        {/* Current/preview image */}
        <div className="relative">
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Profile headshot"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-[var(--color-accent)]/30"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-bg-primary)] text-lg font-black text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30">
              {initials(profileId)}
            </span>
          )}

          {/* Upload overlay */}
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={state === 'uploading'}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition hover:opacity-100"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Upload button and status */}
        <div className="flex-1">
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={state === 'uploading'}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
          >
            {state === 'uploading' ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading...
              </span>
            ) : currentUrl ? (
              'Change photo'
            ) : (
              'Upload photo'
            )}
          </button>

          <p className="mt-1.5 text-xs text-white/40">
            JPG, PNG or WebP. Max 10MB. Will be cropped to a circle.
          </p>

          {error && (
            <p className="mt-1.5 text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Cropper modal */}
      {state === 'cropping' && selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

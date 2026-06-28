'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import type { Tenant, BrandTokens } from '@bench/types';
import {
  updateTenantBrandSettings,
  uploadTenantLogo,
  removeTenantLogo,
  type BrandSettingsState,
} from './brand-actions';
import { contrastRatio, getContrastLevel, validateBrandContrast } from '@/lib/brand/contrast';

const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_ASSETS_CDN_DOMAIN ?? 'assets.bench.opstack.uk';

interface GodmodeBrandPanelProps {
  tenant: Tenant;
}

const initialState: BrandSettingsState = { ok: false };

/**
 * Build the CDN URL for a logo asset (client-side version).
 */
function getLogoUrl(tenantId: string, logoAssetId: string): string {
  const hasExtension = /\.(png|jpg|jpeg|svg)$/i.test(logoAssetId);
  if (hasExtension) {
    return `https://${CLOUDFRONT_DOMAIN}/tenants/${tenantId}/logo-${logoAssetId}`;
  }
  return `https://${CLOUDFRONT_DOMAIN}/tenants/${tenantId}/logo-${logoAssetId}.png`;
}

/**
 * Godmode branding panel for editing any tenant's brand settings.
 * Includes color editing with WCAG AA validation and logo upload.
 */
export function GodmodeBrandPanel({ tenant }: GodmodeBrandPanelProps) {
  const [brandState, brandAction, brandPending] = useActionState(
    updateTenantBrandSettings,
    initialState,
  );
  const [logoState, logoAction, logoPending] = useActionState(uploadTenantLogo, initialState);
  const [removeState, removeAction, removePending] = useActionState(
    removeTenantLogo,
    initialState,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for live preview
  const [localTokens, setLocalTokens] = useState({
    instanceName: tenant.instanceName,
    bgPrimary: tenant.brandTokens.bgPrimary,
    bgPanel: tenant.brandTokens.bgPanel,
    accent: tenant.brandTokens.accent,
    textPrimary: tenant.brandTokens.textPrimary,
    textSecondary: tenant.brandTokens.textSecondary,
  });

  // Track current logo (may be updated after upload)
  const [currentLogoId, setCurrentLogoId] = useState(tenant.brandTokens.logoAssetId);

  // Update logo ID after successful upload
  useEffect(() => {
    if (logoState.ok && logoState.logoAssetId) {
      setCurrentLogoId(logoState.logoAssetId);
    }
  }, [logoState]);

  // Clear logo after successful removal
  useEffect(() => {
    if (removeState.ok) {
      setCurrentLogoId(null);
    }
  }, [removeState]);

  // Live validation
  const [validation, setValidation] = useState(() => validateBrandContrast(localTokens));

  useEffect(() => {
    setValidation(validateBrandContrast(localTokens));
  }, [localTokens]);

  const handleColorChange = (field: keyof typeof localTokens, value: string) => {
    setLocalTokens((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        Branding for {tenant.name}
      </p>

      {/* Success/Error messages */}
      {brandState.ok && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-sm font-semibold text-green-400">Brand settings saved!</p>
        </div>
      )}
      {brandState.error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm font-semibold text-red-400">{brandState.error}</p>
          {brandState.errors && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-400">
              {brandState.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Logo upload section */}
      <div className="mb-6 rounded-lg border border-white/10 bg-[rgba(0,12,24,0.4)] p-4">
        <p className="mb-2 text-sm font-semibold">Logo</p>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Upload PNG, JPG, or SVG (max 1MB). Falls back to a text wordmark if not set.
        </p>

        <div className="flex items-center gap-4">
          {/* Logo preview */}
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/10"
            style={{ backgroundColor: localTokens.bgPrimary }}
          >
            {currentLogoId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getLogoUrl(tenant.id, currentLogoId)}
                alt={tenant.instanceName}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span
                className="text-xs font-bold"
                style={{ color: localTokens.textPrimary }}
              >
                {localTokens.instanceName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Upload/Remove buttons */}
          <div className="flex flex-col gap-2">
            <form action={logoAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input
                ref={fileInputRef}
                type="file"
                name="logo"
                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    e.target.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleLogoClick}
                disabled={logoPending}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {logoPending ? 'Uploading...' : currentLogoId ? 'Change logo' : 'Upload logo'}
              </button>
            </form>

            {currentLogoId && (
              <form action={removeAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <button
                  type="submit"
                  disabled={removePending}
                  className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removePending ? 'Removing...' : 'Remove logo'}
                </button>
              </form>
            )}
          </div>
        </div>

        {logoState.error && (
          <p className="mt-2 text-xs text-red-400">{logoState.error}</p>
        )}
        {logoState.ok && (
          <p className="mt-2 text-xs text-green-400">Logo uploaded successfully!</p>
        )}
      </div>

      {/* Brand settings form */}
      <form action={brandAction}>
        <input type="hidden" name="tenantId" value={tenant.id} />

        {/* Instance Name */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold">Portal Name</label>
          <input
            type="text"
            name="instanceName"
            value={localTokens.instanceName}
            onChange={(e) => handleColorChange('instanceName', e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[rgba(0,12,24,0.6)] px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="e.g., Change Hub"
            required
          />
        </div>

        {/* Colors grid */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <ColorInput
            label="Background Primary"
            name="bgPrimary"
            value={localTokens.bgPrimary}
            onChange={(v) => handleColorChange('bgPrimary', v)}
          />
          <ColorInput
            label="Background Panel"
            name="bgPanel"
            value={localTokens.bgPanel}
            onChange={(v) => handleColorChange('bgPanel', v)}
          />
          <ColorInput
            label="Accent"
            name="accent"
            value={localTokens.accent}
            onChange={(v) => handleColorChange('accent', v)}
          />
          <ColorInput
            label="Text Primary"
            name="textPrimary"
            value={localTokens.textPrimary}
            onChange={(v) => handleColorChange('textPrimary', v)}
          />
          <ColorInput
            label="Text Secondary"
            name="textSecondary"
            value={localTokens.textSecondary}
            onChange={(v) => handleColorChange('textSecondary', v)}
          />
        </div>

        {/* Contrast checks */}
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Contrast Checks
          </p>
          <ContrastCheck
            label="Primary text on bg"
            color1={localTokens.textPrimary}
            color2={localTokens.bgPrimary}
            requiredRatio={4.5}
          />
          <ContrastCheck
            label="Secondary text on bg"
            color1={localTokens.textSecondary}
            color2={localTokens.bgPrimary}
            requiredRatio={4.5}
          />
          <ContrastCheck
            label="Accent on bg (UI)"
            color1={localTokens.accent}
            color2={localTokens.bgPrimary}
            requiredRatio={3}
          />
        </div>

        {/* Preview */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">Preview</p>
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: localTokens.bgPrimary }}
          >
            <div className="flex items-center gap-2">
              {currentLogoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getLogoUrl(tenant.id, currentLogoId)}
                  alt="Logo"
                  className="h-6"
                />
              ) : (
                <span
                  className="text-sm font-bold"
                  style={{ color: localTokens.textPrimary }}
                >
                  {localTokens.instanceName || 'Portal'}
                </span>
              )}
            </div>
            <div
              className="mt-3 rounded p-3"
              style={{ backgroundColor: localTokens.bgPanel }}
            >
              <p style={{ color: localTokens.textPrimary }} className="text-sm">
                Primary text
              </p>
              <p style={{ color: localTokens.textSecondary }} className="text-xs">
                Secondary text
              </p>
              <button
                type="button"
                className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: localTokens.accent,
                  color: localTokens.bgPrimary,
                }}
              >
                Accent
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={brandPending || !validation.valid}
            className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {brandPending ? 'Saving...' : 'Save Brand'}
          </button>
          {!validation.valid && (
            <span className="text-xs text-red-400">Fix contrast issues first</span>
          )}
        </div>
      </form>
    </div>
  );
}

function ColorInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
          className="flex-1 rounded-lg border border-white/10 bg-[rgba(0,12,24,0.6)] px-3 py-1.5 font-mono text-xs text-white focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="#000000"
          required
        />
      </div>
    </div>
  );
}

function ContrastCheck({
  label,
  color1,
  color2,
  requiredRatio,
}: {
  label: string;
  color1: string;
  color2: string;
  requiredRatio: number;
}) {
  const ratio = contrastRatio(color1, color2);
  const level = getContrastLevel(ratio);
  const passes = ratio >= requiredRatio;

  return (
    <div className="flex items-center justify-between rounded border border-white/10 bg-[rgba(0,12,24,0.4)] px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded"
          style={{ backgroundColor: color1 }}
        />
        <span className="text-white/40">/</span>
        <span
          className="inline-block h-3 w-3 rounded"
          style={{ backgroundColor: color2 }}
        />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">{ratio.toFixed(2)}:1</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            passes ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {passes ? (level === 'aaa' ? 'AAA' : 'AA') : 'Fail'}
        </span>
      </div>
    </div>
  );
}

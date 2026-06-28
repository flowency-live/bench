'use client';

import { useActionState, useState, useEffect } from 'react';
import type { BrandTokens } from '@bench/types';
import { updateBrandSettings, type BrandSettingsState } from './actions';
import { contrastRatio, getContrastLevel, validateBrandContrast } from '@/lib/brand/contrast';

interface BrandSettingsFormProps {
  instanceName: string;
  brandTokens: BrandTokens;
}

const initialState: BrandSettingsState = { ok: false };

export function BrandSettingsForm({ instanceName, brandTokens }: BrandSettingsFormProps) {
  const [state, action, pending] = useActionState(updateBrandSettings, initialState);

  // Local state for live preview
  const [localTokens, setLocalTokens] = useState({
    instanceName,
    bgPrimary: brandTokens.bgPrimary,
    bgPanel: brandTokens.bgPanel,
    accent: brandTokens.accent,
    textPrimary: brandTokens.textPrimary,
    textSecondary: brandTokens.textSecondary,
  });

  // Live validation
  const [validation, setValidation] = useState(() => validateBrandContrast(localTokens));

  useEffect(() => {
    setValidation(validateBrandContrast(localTokens));
  }, [localTokens]);

  const handleColorChange = (field: keyof typeof localTokens, value: string) => {
    setLocalTokens((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form action={action} className="space-y-8">
      {/* Success message */}
      {state.ok && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-semibold text-green-400">Brand settings saved successfully!</p>
          {state.warnings && state.warnings.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-yellow-400">
              {state.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Error message */}
      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-400">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Instance Name */}
      <section className="rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <h2 className="text-lg font-black">Portal Name</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          The name displayed in the header and throughout your portal.
        </p>
        <input
          type="text"
          name="instanceName"
          value={localTokens.instanceName}
          onChange={(e) => handleColorChange('instanceName', e.target.value)}
          className="mt-4 w-full rounded-lg border border-white/10 bg-[var(--color-bg-primary)] px-4 py-3 text-white placeholder:text-white/30 focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="e.g., Change Hub"
          required
        />
      </section>

      {/* Colors */}
      <section className="rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <h2 className="text-lg font-black">Colors</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Customize your brand colors. All combinations must meet WCAG 2.1 AA accessibility standards.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <ColorInput
            label="Background Primary"
            name="bgPrimary"
            value={localTokens.bgPrimary}
            onChange={(v) => handleColorChange('bgPrimary', v)}
            description="Main background color"
          />
          <ColorInput
            label="Background Panel"
            name="bgPanel"
            value={localTokens.bgPanel}
            onChange={(v) => handleColorChange('bgPanel', v)}
            description="Cards and panels"
          />
          <ColorInput
            label="Accent"
            name="accent"
            value={localTokens.accent}
            onChange={(v) => handleColorChange('accent', v)}
            description="Buttons and highlights"
          />
          <ColorInput
            label="Text Primary"
            name="textPrimary"
            value={localTokens.textPrimary}
            onChange={(v) => handleColorChange('textPrimary', v)}
            description="Main text color"
          />
          <ColorInput
            label="Text Secondary"
            name="textSecondary"
            value={localTokens.textSecondary}
            onChange={(v) => handleColorChange('textSecondary', v)}
            description="Muted text color"
          />
        </div>

        {/* Live contrast checks */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold">Contrast Checks</h3>
          <ContrastCheck
            label="Primary text on background"
            color1={localTokens.textPrimary}
            color2={localTokens.bgPrimary}
            requiredRatio={4.5}
          />
          <ContrastCheck
            label="Secondary text on background"
            color1={localTokens.textSecondary}
            color2={localTokens.bgPrimary}
            requiredRatio={4.5}
          />
          <ContrastCheck
            label="Primary text on panel"
            color1={localTokens.textPrimary}
            color2={localTokens.bgPanel}
            requiredRatio={4.5}
          />
          <ContrastCheck
            label="Accent on background"
            color1={localTokens.accent}
            color2={localTokens.bgPrimary}
            requiredRatio={3}
          />
          <ContrastCheck
            label="Accent on panel"
            color1={localTokens.accent}
            color2={localTokens.bgPanel}
            requiredRatio={3}
          />
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-xl border border-white/10 bg-[var(--color-bg-panel)] p-6">
        <h2 className="text-lg font-black">Preview</h2>
        <div
          className="mt-4 rounded-lg p-6"
          style={{ backgroundColor: localTokens.bgPrimary }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold"
              style={{ color: localTokens.accent }}
            >
              {localTokens.instanceName || 'Portal Name'}
            </span>
          </div>
          <div
            className="mt-4 rounded-lg p-4"
            style={{ backgroundColor: localTokens.bgPanel }}
          >
            <p style={{ color: localTokens.textPrimary }}>
              This is primary text on a panel.
            </p>
            <p style={{ color: localTokens.textSecondary }} className="mt-1 text-sm">
              This is secondary text for less important information.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: localTokens.accent,
                color: localTokens.bgPrimary,
              }}
            >
              Accent Button
            </button>
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending || !validation.valid}
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-black uppercase tracking-wide text-[var(--color-bg-primary)] transition hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving...' : 'Save Brand Settings'}
        </button>
        {!validation.valid && (
          <span className="text-sm text-red-400">
            Fix contrast issues before saving
          </span>
        )}
      </div>
    </form>
  );
}

function ColorInput({
  label,
  name,
  value,
  onChange,
  description,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  description: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold">{label}</label>
      <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
          className="flex-1 rounded-lg border border-white/10 bg-[var(--color-bg-primary)] px-3 py-2 font-mono text-sm text-white focus:border-[var(--color-accent)] focus:outline-none"
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
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[var(--color-bg-primary)] px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span
            className="inline-block h-4 w-4 rounded"
            style={{ backgroundColor: color1 }}
          />
          <span className="text-white/40">/</span>
          <span
            className="inline-block h-4 w-4 rounded"
            style={{ backgroundColor: color2 }}
          />
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{ratio.toFixed(2)}:1</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
            passes
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {passes ? (level === 'aaa' ? 'AAA' : 'AA') : 'Fail'}
        </span>
      </div>
    </div>
  );
}

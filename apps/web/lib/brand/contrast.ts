/**
 * WCAG 2.1 AA Color Contrast Utilities
 *
 * Per CLAUDE.md:
 * - Normal text (<18pt): Minimum 4.5:1 contrast ratio
 * - Large text (>=18pt or >=14pt bold): Minimum 3:1 contrast ratio
 * - UI components & graphics: Minimum 3:1 contrast ratio
 */

/**
 * Parse a hex color to RGB values.
 * Supports 3-char (#abc) and 6-char (#aabbcc) hex.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace('#', '');

  let r: number, g: number, b: number;

  if (sanitized.length === 3) {
    const c0 = sanitized.charAt(0);
    const c1 = sanitized.charAt(1);
    const c2 = sanitized.charAt(2);
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else if (sanitized.length === 6) {
    r = parseInt(sanitized.slice(0, 2), 16);
    g = parseInt(sanitized.slice(2, 4), 16);
    b = parseInt(sanitized.slice(4, 6), 16);
  } else {
    return null;
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  return { r, g, b };
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };

  const rs = toLinear(r);
  const gs = toLinear(g);
  const bs = toLinear(b);

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors.
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 *
 * @returns Contrast ratio (1:1 to 21:1)
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return 0;

  const L1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const L2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA compliance levels.
 */
export type ContrastLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

/**
 * Check WCAG 2.1 compliance level.
 *
 * @param ratio - Contrast ratio
 * @returns Compliance level
 *   - 'aaa': >= 7:1 (AAA for normal text)
 *   - 'aa': >= 4.5:1 (AA for normal text, AAA for large text)
 *   - 'aa-large': >= 3:1 (AA for large text / UI components)
 *   - 'fail': < 3:1 (Fails WCAG AA)
 */
export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'aa-large';
  return 'fail';
}

/**
 * Check if colors meet WCAG AA for normal text (4.5:1).
 */
export function meetsAANormalText(hex1: string, hex2: string): boolean {
  return contrastRatio(hex1, hex2) >= 4.5;
}

/**
 * Check if colors meet WCAG AA for large text / UI (3:1).
 */
export function meetsAALargeText(hex1: string, hex2: string): boolean {
  return contrastRatio(hex1, hex2) >= 3;
}

/**
 * Validate brand tokens for WCAG AA compliance.
 * Returns an array of validation errors.
 */
export interface ContrastValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function validateBrandContrast(tokens: {
  bgPrimary: string;
  bgPanel: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
}): ContrastValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Primary text on primary background must meet AA (4.5:1)
  const textOnBg = contrastRatio(tokens.textPrimary, tokens.bgPrimary);
  if (textOnBg < 4.5) {
    errors.push(
      `Primary text on background fails AA (${textOnBg.toFixed(2)}:1, need 4.5:1)`
    );
  }

  // Secondary text on primary background should meet AA (4.5:1 for small text)
  const secondaryOnBg = contrastRatio(tokens.textSecondary, tokens.bgPrimary);
  if (secondaryOnBg < 4.5) {
    // It's okay for large text (3:1) but warn
    if (secondaryOnBg < 3) {
      errors.push(
        `Secondary text on background fails AA completely (${secondaryOnBg.toFixed(2)}:1, need at least 3:1)`
      );
    } else {
      warnings.push(
        `Secondary text on background only meets AA for large text (${secondaryOnBg.toFixed(2)}:1)`
      );
    }
  }

  // Primary text on panel background must meet AA (4.5:1)
  const textOnPanel = contrastRatio(tokens.textPrimary, tokens.bgPanel);
  if (textOnPanel < 4.5) {
    errors.push(
      `Primary text on panel fails AA (${textOnPanel.toFixed(2)}:1, need 4.5:1)`
    );
  }

  // Accent on both backgrounds must meet AA for UI components (3:1)
  const accentOnBg = contrastRatio(tokens.accent, tokens.bgPrimary);
  if (accentOnBg < 3) {
    errors.push(
      `Accent on background fails AA for UI elements (${accentOnBg.toFixed(2)}:1, need 3:1)`
    );
  } else if (accentOnBg < 4.5) {
    warnings.push(
      `Accent on background only meets AA for large text/UI (${accentOnBg.toFixed(2)}:1)`
    );
  }

  const accentOnPanel = contrastRatio(tokens.accent, tokens.bgPanel);
  if (accentOnPanel < 3) {
    errors.push(
      `Accent on panel fails AA for UI elements (${accentOnPanel.toFixed(2)}:1, need 3:1)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

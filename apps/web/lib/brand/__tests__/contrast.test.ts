/**
 * WCAG contrast utility tests
 */
import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  getContrastLevel,
  meetsAANormalText,
  meetsAALargeText,
  validateBrandContrast,
} from '../contrast';

describe('hexToRgb', () => {
  it('parses 6-char hex', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses 3-char hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('handles without hash prefix', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('#gggggg')).toBeNull();
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1 for same color', () => {
    const ratio = contrastRatio('#ffffff', '#ffffff');
    expect(ratio).toBeCloseTo(1, 0);
  });

  it('returns same ratio regardless of order', () => {
    const ratio1 = contrastRatio('#000000', '#ffffff');
    const ratio2 = contrastRatio('#ffffff', '#000000');
    expect(ratio1).toBeCloseTo(ratio2, 5);
  });
});

describe('getContrastLevel', () => {
  it('returns aaa for >= 7:1', () => {
    expect(getContrastLevel(7)).toBe('aaa');
    expect(getContrastLevel(21)).toBe('aaa');
  });

  it('returns aa for >= 4.5:1 and < 7:1', () => {
    expect(getContrastLevel(4.5)).toBe('aa');
    expect(getContrastLevel(6.9)).toBe('aa');
  });

  it('returns aa-large for >= 3:1 and < 4.5:1', () => {
    expect(getContrastLevel(3)).toBe('aa-large');
    expect(getContrastLevel(4.4)).toBe('aa-large');
  });

  it('returns fail for < 3:1', () => {
    expect(getContrastLevel(2.9)).toBe('fail');
    expect(getContrastLevel(1)).toBe('fail');
  });
});

describe('meetsAANormalText', () => {
  it('returns true for >= 4.5:1', () => {
    expect(meetsAANormalText('#000000', '#ffffff')).toBe(true);
  });

  it('returns false for < 4.5:1', () => {
    // Gray on white with low contrast
    expect(meetsAANormalText('#767676', '#ffffff')).toBe(true); // Exactly 4.54:1
    expect(meetsAANormalText('#777777', '#ffffff')).toBe(false); // 4.48:1
  });
});

describe('meetsAALargeText', () => {
  it('returns true for >= 3:1', () => {
    expect(meetsAALargeText('#000000', '#ffffff')).toBe(true);
    expect(meetsAALargeText('#595959', '#ffffff')).toBe(true); // ~7:1
  });

  it('returns false for < 3:1', () => {
    expect(meetsAALargeText('#ffffff', '#ffffff')).toBe(false);
  });
});

describe('validateBrandContrast', () => {
  it('validates good brand tokens', () => {
    const result = validateBrandContrast({
      bgPrimary: '#001930',
      bgPanel: '#002e52',
      accent: '#baeb5b',
      textPrimary: '#ffffff',
      textSecondary: '#9dadc8',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for low contrast primary text', () => {
    const result = validateBrandContrast({
      bgPrimary: '#333333',
      bgPanel: '#444444',
      accent: '#555555',
      textPrimary: '#555555', // Low contrast on #333333
      textSecondary: '#666666',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

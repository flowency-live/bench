'use client';

import { useEffect } from 'react';

/**
 * Scales the profile to fit ONE page, then opens the print dialog.
 *
 * After fonts/layout settle, it measures the rendered content against the A4
 * sheet height and, if it overflows, applies a downward CSS scale to the inner
 * wrapper so the whole one-pager lands on a single page (width is pre-expanded
 * so the scaled result still fills the page). Then it fires `window.print()` so
 * opening the page goes straight to "Save as PDF".
 */
export function PrintTrigger() {
  useEffect(() => {
    let cancelled = false;

    async function fitAndPrint() {
      // Wait for web fonts so the height measurement is accurate.
      try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      } catch {
        // ignore — fall through to measure with whatever is loaded
      }
      if (cancelled) return;

      const page = document.querySelector<HTMLElement>('.pdf-page');
      const scale = document.querySelector<HTMLElement>('.pdf-scale');

      if (page && scale) {
        const available = page.clientHeight;
        const content = scale.scrollHeight;
        if (content > available + 2) {
          // Clamp so we never shrink to an unreadable size.
          const s = Math.max(0.45, available / content);
          scale.style.width = `${100 / s}%`;
          scale.style.transform = `scale(${s})`;
        }
      }

      requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    }

    fitAndPrint();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

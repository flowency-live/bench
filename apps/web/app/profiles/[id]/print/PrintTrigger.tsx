'use client';

import { useEffect } from 'react';

/**
 * Scales the profile to fit ONE page, then opens the print dialog.
 *
 * The renderer is natural height. We measure it against the A4 sheet and, if it
 * overflows, scale it down. To keep it filling the page width after shrinking, we
 * pre-widen the wrapper (which reflows the text shorter), re-measure, then apply
 * the final scale. A small safety factor absorbs the difference between the
 * on-screen pixel metric used here and the physical print metric. Then it fires
 * `window.print()` so opening the page goes straight to "Save as PDF".
 */
export function PrintTrigger() {
  useEffect(() => {
    let cancelled = false;

    async function fitAndPrint() {
      // Wait for web fonts so the height measurement is accurate.
      try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      } catch {
        // ignore — measure with whatever is loaded
      }
      if (cancelled) return;

      const page = document.querySelector<HTMLElement>('.pdf-page');
      const scale = document.querySelector<HTMLElement>('.pdf-scale');

      if (page && scale) {
        // 3% safety margin for on-screen-px vs physical-print drift + any
        // residual printer margin, so content never spills onto a second page.
        const target = page.clientHeight * 0.97;

        scale.style.transformOrigin = 'top left';
        scale.style.transform = '';
        scale.style.width = '100%';

        const natural = scale.scrollHeight;
        if (natural > target) {
          const s = target / natural;
          // Widen by exactly 1/s so that, once scaled by s, the width returns to
          // 100% (no horizontal clip) and the height is <= target (one page).
          scale.style.width = `${(100 / s).toFixed(3)}%`;
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

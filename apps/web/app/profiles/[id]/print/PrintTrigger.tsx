'use client';

import { useEffect } from 'react';

/**
 * Pops the browser print dialog on mount so opening the print page goes straight
 * to "Save as PDF". A short rAF delay lets fonts/layout settle before printing.
 */
export function PrintTrigger() {
  useEffect(() => {
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, []);

  return null;
}

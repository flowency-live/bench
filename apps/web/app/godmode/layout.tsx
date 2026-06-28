import { Plus_Jakarta_Sans } from 'next/font/google';

/**
 * Godmode (platform super-admin) layout.
 *
 * Godmode is the FLOWENCY control plane, not a tenant surface — so it carries
 * Flowency's brand (www.flowency.co.uk: deep charcoal-navy, off-white text,
 * terracotta accent + teal flow, Plus Jakarta Sans, sharp corners), NOT the
 * tenant's navy/lime. The theme lives in `globals.css` scoped to
 * `.flowency-godmode`, which also overrides the tenant `--color-*` tokens so the
 * existing dashboard + TenantRow render Flowency without per-class edits.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export default function GodmodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} flowency-godmode min-h-screen`}>
      {children}
    </div>
  );
}

import { LOGO_BASE64 } from '@/lib/logo-data';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Change Connected logo component.
 * Uses base64-embedded image to avoid static file serving issues in SSR deployments.
 */
export function Logo({ className = '', width = 280, height = 56 }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_BASE64}
      alt="Change Connected"
      width={width}
      height={height}
      className={className}
    />
  );
}

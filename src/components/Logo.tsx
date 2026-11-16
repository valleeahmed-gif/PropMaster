import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

/**
 * PropMaster mark: a house with a key-shaped "P", gold and white on flag
 * green. Drawn inline so it stays sharp at every size and has no
 * background of its own. Same artwork as public/logo.svg.
 */
export function LogoIcon({ size = 32, className = '' }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`flex-shrink-0 ${className}`}
      role="img"
      aria-label="PropMaster"
    >
      <rect width="64" height="64" rx="15" fill="#007749" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 30.5 32 12.5l20.5 18" stroke="#FFB81C" strokeWidth="5.5" />
        <path d="M17.5 26v24.5h9.5M46.5 26v24.5H37" stroke="#FFB81C" strokeWidth="5.5" />
        <circle cx="32" cy="32.5" r="6.2" stroke="#FFFFFF" strokeWidth="5" />
        <path d="M32 38.7v12.3M32 45.6h4.6" stroke="#FFFFFF" strokeWidth="5" />
      </g>
    </svg>
  );
}

// Full lockup: icon + wordmark
export function LogoLockup({ size = 32, className = '' }: LogoIconProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      <span
        className="font-display font-bold tracking-tight"
        style={{ fontSize: size * 0.53, lineHeight: 1, color: 'currentColor' }}
      >
        PropMaster
      </span>
    </div>
  );
}

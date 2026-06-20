import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

// PropMaster icon — uses the uploaded PNG logo
export function LogoIcon({ size = 32, className = '' }: LogoIconProps) {
  return (
    <img
      src="/propmaster-logo.png"
      alt="PropMaster"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: size * 0.22, objectFit: 'cover' }}
    />
  );
}

// Full lockup: icon + wordmark
export function LogoLockup({ size = 32, className = '' }: LogoIconProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      <span
        style={{
          fontSize: size * 0.53,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: 'currentColor',
          lineHeight: 1,
        }}
      >
        PropMaster
      </span>
    </div>
  );
}

import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

// PropMaster icon — estate house with brass accent
export function LogoIcon({ size = 32, className = '' }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="pmBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e7c64"/>
          <stop offset="100%" stopColor="#052520"/>
        </linearGradient>
        <linearGradient id="pmBrass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ddb04a"/>
          <stop offset="100%" stopColor="#a87a1e"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#pmBg)"/>
      {/* Roof */}
      <polygon points="256,92 88,248 424,248" fill="none" stroke="url(#pmBrass)" strokeWidth="18" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Body */}
      <rect x="128" y="248" width="256" height="176" rx="6" fill="none" stroke="white" strokeWidth="18" strokeLinejoin="round"/>
      {/* Arch door */}
      <path d="M218 424 L218 330 Q218 300 256 300 Q294 300 294 330 L294 424" fill="none" stroke="url(#pmBrass)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Door knob */}
      <circle cx="283" cy="368" r="8" fill="url(#pmBrass)"/>
      {/* Left window */}
      <rect x="148" y="280" width="46" height="42" rx="4" fill="none" stroke="white" strokeWidth="12" opacity="0.7"/>
      <line x1="148" y1="301" x2="194" y2="301" stroke="white" strokeWidth="8" opacity="0.5"/>
      <line x1="171" y1="280" x2="171" y2="322" stroke="white" strokeWidth="8" opacity="0.5"/>
      {/* Right window */}
      <rect x="318" y="280" width="46" height="42" rx="4" fill="none" stroke="white" strokeWidth="12" opacity="0.7"/>
      <line x1="318" y1="301" x2="364" y2="301" stroke="white" strokeWidth="8" opacity="0.5"/>
      <line x1="341" y1="280" x2="341" y2="322" stroke="white" strokeWidth="8" opacity="0.5"/>
      {/* Chimney */}
      <rect x="308" y="108" width="32" height="60" rx="4" fill="url(#pmBrass)"/>
      {/* Ground line */}
      <line x1="96" y1="424" x2="416" y2="424" stroke="url(#pmBrass)" strokeWidth="10" strokeLinecap="round" opacity="0.6"/>
    </svg>
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

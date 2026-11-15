import React from 'react';

/** The six flag colours as one thin band. */
export function FlagRibbon({ className = '' }: { className?: string }) {
  return <div className={`flag-ribbon ${className}`} aria-hidden="true" />;
}

interface FlagArtProps {
  className?: string;
  style?: React.CSSProperties;
  /** How the artwork fills its box. Default keeps the convergence point in view. */
  preserveAspectRatio?: string;
}

/**
 * Abstract motif built from the South African flag's colours and its
 * converging bands — drawn as stripes on a black field rather than as the
 * flag itself. Purely decorative.
 */
export function FlagArt({ className = '', style, preserveAspectRatio = 'xMinYMid slice' }: FlagArtProps) {
  const stroke = { fill: 'none', strokeLinejoin: 'miter' as const, strokeMiterlimit: 8 };
  return (
    <svg
      viewBox="0 0 420 400"
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* gold: inside the notch */}
      <path d="M-42.9 .9 138.1 200-42.9 399.1" stroke="#FFB81C" strokeWidth="22" {...stroke} />
      {/* green: the two arms meeting and running on as one band */}
      <path d="M-20-20 180 200-20 420M180 200H2400" stroke="#007749" strokeWidth="40" {...stroke} />
      {/* white edges */}
      <path d="M-.8-37.5 191.5 174H2400M-.8 437.5 191.5 226H2400" stroke="#FFFFFF" strokeWidth="12" {...stroke} />
      {/* red above, blue below */}
      <path d="M18.5-55 203 148H2400" stroke="#E03C31" strokeWidth="40" {...stroke} />
      <path d="M18.5 455 203 252H2400" stroke="#001489" strokeWidth="40" {...stroke} />
    </svg>
  );
}

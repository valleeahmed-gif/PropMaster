import React from 'react';

/** Four-colour accent bar (green · gold · red · blue in equal parts). */
export function ColourBar({ className = '' }: { className?: string }) {
  return <div className={`colour-bar ${className}`} aria-hidden="true" />;
}

interface ColourTilesProps {
  className?: string;
  style?: React.CSSProperties;
  preserveAspectRatio?: string;
}

const G = '#007749', Y = '#FFB81C', R = '#E03C31', B = '#001489', W = '#FFFFFF';

/**
 * Decorative pattern: a grid of geometric tiles in the palette colours —
 * squares, quarter and half circles, like a tiled wall or a block of plots.
 * Uses the colours only, not the flag's design.
 */
export function ColourTiles({ className = '', style, preserveAspectRatio = 'xMidYMid slice' }: ColourTilesProps) {
  // Each tile is 100×100 with a 10-unit gap; 4 columns × 4 rows.
  const s = 100, gap = 10;
  const at = (c: number, r: number) => ({ x: c * (s + gap), y: r * (s + gap) });
  const tiles: React.ReactNode[] = [];
  const add = (key: string, el: React.ReactNode) => tiles.push(<React.Fragment key={key}>{el}</React.Fragment>);

  const square = (c: number, r: number, fill: string) => { const { x, y } = at(c, r); add(`s${c}${r}`, <rect x={x} y={y} width={s} height={s} rx={14} fill={fill} />); };
  // Quarter circle anchored in one corner of the tile.
  const quarter = (c: number, r: number, fill: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    const { x, y } = at(c, r);
    const cx = corner.includes('l') ? x : x + s, cy = corner.startsWith('t') ? y : y + s;
    const sx = corner.includes('l') ? x + s : x, sy = cy;
    const ex = cx, ey = corner.startsWith('t') ? y + s : y;
    const sweep = corner === 'tl' || corner === 'br' ? 1 : 0;
    add(`q${c}${r}`, <path d={`M${cx} ${cy}L${sx} ${sy}A${s} ${s} 0 0 ${sweep} ${ex} ${ey}Z`} fill={fill} />);
  };
  // Half circle on one side of the tile.
  const half = (c: number, r: number, fill: string, side: 'top' | 'bottom' | 'left' | 'right') => {
    const { x, y } = at(c, r), h = s / 2;
    const d = {
      bottom: `M${x} ${y + s}A${h} ${h} 0 0 1 ${x + s} ${y + s}Z`,
      top:    `M${x} ${y}A${h} ${h} 0 0 0 ${x + s} ${y}Z`,
      left:   `M${x} ${y}A${h} ${h} 0 0 1 ${x} ${y + s}Z`,
      right:  `M${x + s} ${y}A${h} ${h} 0 0 0 ${x + s} ${y + s}Z`,
    }[side];
    add(`h${c}${r}`, <path d={d} fill={fill} />);
  };
  const circle = (c: number, r: number, fill: string, ring = false) => {
    const { x, y } = at(c, r);
    add(`c${c}${r}`, ring
      ? <circle cx={x + s / 2} cy={y + s / 2} r={s / 2 - 9} fill="none" stroke={fill} strokeWidth={18} />
      : <circle cx={x + s / 2} cy={y + s / 2} r={s / 2} fill={fill} />);
  };

  // Row 0
  quarter(0, 0, Y, 'br'); square(1, 0, G); circle(2, 0, R); quarter(3, 0, B, 'bl');
  // Row 1
  square(0, 1, B); half(1, 1, Y, 'bottom'); square(2, 1, G); circle(3, 1, W, true);
  // Row 2
  circle(0, 2, G); quarter(1, 2, R, 'tr'); half(2, 2, B, 'left'); square(3, 2, Y);
  // Row 3
  half(0, 3, R, 'top'); square(1, 3, Y); quarter(2, 3, G, 'tl'); square(3, 3, R);

  const size = 4 * s + 3 * gap;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio={preserveAspectRatio} className={className} style={style} aria-hidden="true" focusable="false">
      {tiles}
    </svg>
  );
}

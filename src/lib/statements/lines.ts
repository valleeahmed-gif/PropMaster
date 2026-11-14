import { Cell, Line } from './types';

/**
 * Build Lines from plain text (OCR output, pasted text, tests). Runs of two or
 * more spaces are treated as column gaps; character offsets stand in for x.
 */
export function linesFromText(text: string, page = 1): Line[] {
  const out: Line[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const expanded = raw.replace(/\t/g, '    ');
    if (!expanded.trim()) continue;
    const cells: Cell[] = [];
    const re = /\S+(?: \S+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expanded))) cells.push({ str: m[0], x: m.index, x2: m.index + m[0].length });
    out.push({ text: cells.map(c => c.str).join('  '), cells, page });
  }
  return out;
}

/** Positioned text fragment as produced by a PDF text layer. */
export interface Fragment {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Group positioned fragments into lines (same baseline) and cells (fragments
 * separated by no more than a word space). Y grows upward, as in PDF space.
 */
export function linesFromFragments(fragments: Fragment[], page: number): Line[] {
  const frags = fragments.filter(f => f.str.trim() !== '');
  if (frags.length === 0) return [];
  // Sort top-to-bottom, then left-to-right.
  frags.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Fragment[][] = [];
  for (const f of frags) {
    const row = rows[rows.length - 1];
    const tol = Math.max(2, Math.min(f.height || 8, row?.[0].height || 8) * 0.45);
    if (row && Math.abs(row[0].y - f.y) <= tol) row.push(f);
    else rows.push([f]);
  }

  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    // Some generators emit a whole printed row as one fragment with runs of
    // spaces between columns — split those into separate fragments first.
    const parts: Fragment[] = [];
    for (const f of row) {
      if (!/\s{2,}/.test(f.str.trim())) { parts.push(f); continue; }
      const charW = f.str.length ? f.width / f.str.length : 0;
      const re = /\S+(?: \S+)*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.str))) {
        parts.push({ str: m[0], x: f.x + m.index * charW, y: f.y, width: m[0].length * charW, height: f.height });
      }
    }
    for (const f of parts) {
      const str = f.str.replace(/\s+/g, ' ');
      const charW = f.width > 0 && f.str.length > 0 ? f.width / f.str.length : (f.height || 8) * 0.5;
      const last = cells[cells.length - 1];
      const gap = last ? f.x - last.x2 : Infinity;
      if (last && gap <= charW * 1.6) {
        // Same cell: glue directly when touching, otherwise one space.
        const needsSpace = gap > charW * 0.25 && !last.str.endsWith(' ') && !str.startsWith(' ');
        last.str += (needsSpace ? ' ' : '') + str;
        last.x2 = f.x + f.width;
      } else {
        cells.push({ str: str.trimStart(), x: f.x, x2: f.x + f.width });
      }
    }
    for (const c of cells) c.str = c.str.trim();
    const kept = cells.filter(c => c.str);
    if (kept.length) lines.push({ text: kept.map(c => c.str).join('  '), cells: kept, page });
  }
  return lines;
}

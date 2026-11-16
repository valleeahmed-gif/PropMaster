import { ChargeCategory } from './types';

interface Rule { category: ChargeCategory; re: RegExp }

// Order matters: the first rule that matches wins.
const RULES: Rule[] = [
  { category: 'interest',         re: /\binterest\b|\brente\b/ },
  { category: 'csos',             re: /\bcsos\b|community schemes? ombud/ },
  { category: 'water_sanitation', re: /johannesburg water|water\s*(&|and|en|\/)\s*(sanitation|sewer\w*|riool\w*)/ },
  { category: 'electricity',      re: /city power|electric|elektrisiteit|\belec\b|\bkwh\b|\bkrag\b|\beskom\b|energy charge/ },
  { category: 'sewerage',         re: /sewer|sanitation|riool|effluent/ },
  { category: 'water',            re: /\bwater\b/ },
  { category: 'refuse',           re: /pikitup|refuse|\bwaste\b|vullis|cleansing|city cleaning/ },
  { category: 'gas',              re: /\bgas\b/ },
  { category: 'rates',            re: /property rates|assessment rates|\brates\b|eiendomsbelasting|erfbelasting/ },
  { category: 'insurance',        re: /insurance|versekering/ },
  { category: 'security',         re: /security|sekuriteit|access control|armed response/ },
  { category: 'special_levy',     re: /special\s+(lev(y|ies)|contribution)|spesiale heffing/ },
  { category: 'reserve_levy',     re: /reserve|reserwe|maintenance fund|capex/ },
  { category: 'levy',             re: /\blev(y|ies)\b|heffing|\bcontributions?\b|admin(istrative)? fund/ },
];

export function classify(description: string): ChargeCategory | null {
  const d = description.toLowerCase();
  for (const r of RULES) if (r.re.test(d)) return r.category;
  return null;
}

const LABELS: Record<ChargeCategory, string> = {
  electricity: 'Electricity',
  water: 'Water',
  sewerage: 'Sewerage',
  water_sanitation: 'Water & Sanitation',
  refuse: 'Refuse Removal',
  gas: 'Gas',
  rates: 'Rates',
  levy: 'Levy',
  reserve_levy: 'Reserve Fund Levy',
  special_levy: 'Special Levy',
  csos: 'CSOS Levy',
  insurance: 'Insurance',
  security: 'Security',
  interest: 'Interest',
  sundry: 'Sundry',
};

export const labelFor = (c: ChargeCategory) => LABELS[c];

const RECOVERABLE = new Set<ChargeCategory>(['electricity', 'water', 'sewerage', 'water_sanitation', 'refuse', 'gas']);

/** Usage-based charges a tenant normally pays; ownership costs (rates, levies) default to the owner. */
export const isRecoverable = (c: ChargeCategory) => RECOVERABLE.has(c);

/** Municipal services that carry VAT. Property rates, interest and body corporate levies do not. */
export const isVatable = (c: ChargeCategory) => RECOVERABLE.has(c);

/**
 * Category from a transaction reference code such as "WAT0726" or
 * "RES0826", used when a row has no readable description.
 */
export function classifyReference(text: string): ChargeCategory | null {
  const m = /\b(ELEC?|ELE|WAT|WTR|SEW|SAN|REF|RFS|GAS|RES|RSV|LEV|LVY|ADM|SPL|SPEC|CSOS|INS|SEC|INT|RAT)[-_]?\d{2,}/i.exec(text);
  if (!m) return null;
  const code = m[1].toUpperCase();
  const map: Record<string, ChargeCategory> = {
    ELE: 'electricity', ELEC: 'electricity', WAT: 'water', WTR: 'water', SEW: 'sewerage', SAN: 'sewerage',
    REF: 'refuse', RFS: 'refuse', GAS: 'gas', RES: 'reserve_levy', RSV: 'reserve_levy', LEV: 'levy', LVY: 'levy',
    ADM: 'levy', SPL: 'special_levy', SPEC: 'special_levy', CSOS: 'csos', INS: 'insurance', SEC: 'security',
    INT: 'interest', RAT: 'rates',
  };
  return map[code] ?? null;
}

/** Display order for extracted items. */
export const CATEGORY_ORDER: ChargeCategory[] = [
  'electricity', 'water_sanitation', 'water', 'sewerage', 'refuse', 'gas',
  'rates', 'levy', 'reserve_levy', 'special_levy', 'csos', 'insurance', 'security', 'sundry', 'interest',
];

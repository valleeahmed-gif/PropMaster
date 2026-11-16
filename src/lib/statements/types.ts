// Types for the built-in (non-AI) statement reader.

/** One horizontal run of text on a line. `x`/`x2` are left/right edges (page units or character columns). */
export interface Cell {
  str: string;
  x: number;
  x2: number;
}

/** One visual line of the document, left-to-right. */
export interface Line {
  text: string;
  cells: Cell[];
  page: number;
  /** Vertical position, increasing down the page (line index for plain text). */
  y?: number;
  /** Line height in the same units as y. */
  h?: number;
}

export type ChargeCategory =
  | 'electricity' | 'water' | 'sewerage' | 'water_sanitation' | 'refuse' | 'gas'
  | 'rates' | 'levy' | 'reserve_levy' | 'special_levy' | 'csos' | 'insurance'
  | 'security' | 'interest' | 'sundry';

export interface ParsedItem {
  /** Plain-English label, e.g. "Electricity". */
  label: string;
  /** Rand amount for the current period, VAT inclusive where the statement allows. */
  amount: number;
  /** True for usage charges a tenant normally pays (electricity, water, refuse…). */
  isRecoverable: boolean;
  /** Municipal services that carry 15% VAT (electricity, water, sewer, refuse, gas). */
  vatable: boolean;
  category: ChargeCategory;
  /** Metered usage when printed, e.g. { value: 623, unit: 'kWh' }. */
  consumption?: { value: number; unit: 'kWh' | 'kl' };
  /** Whether the meter reading was actual or estimated, when stated. */
  readingType?: 'actual' | 'estimated';
}

export type StatementKind = 'municipal' | 'levy' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedStatement {
  kind: StatementKind;
  /** e.g. "City of Johannesburg". */
  issuer?: string;
  accountNumber?: string;
  /** ISO date (YYYY-MM-DD) printed on the statement. */
  statementDate?: string;
  dueDate?: string;
  /** Billing month the charges belong to. */
  period?: { month: number; year: number };
  items: ParsedItem[];
  totals: {
    /** Current-period charges incl. VAT as printed (or excl + VAT). */
    currentCharges?: number;
    vat?: number;
    previousBalance?: number;
    totalDue?: number;
  };
  /** true = items add up to the statement's own current-charges total; null = no total to check against. */
  reconciled: boolean | null;
  /** The statement listed services excluding VAT and the reader added it. */
  vatAdded: boolean;
  /** Multiplier the reader used (or would use) to add VAT to vatable items, e.g. 1.15. */
  vatRatio: number;
  confidence: Confidence;
  /** Human-readable notes for the reviewer. */
  warnings: string[];
  /** How the text was obtained. */
  method: 'text' | 'ocr';
}

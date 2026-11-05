// supabase/functions/extract-statement/index.ts
// Deploy with: supabase functions deploy extract-statement
// Set secret:  supabase secrets set ANTHROPIC_API_KEY=your_key_here
//
// Receives a base64 PDF (municipal / levy statement), asks Claude to
// extract the individual charge lines, and returns them for the landlord
// to review. Nothing is written to running costs here — the client adds
// the items the landlord confirms.

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ~10 MB PDF → ~13.4 MB base64. Keeps us well under the API's 32 MB
// request limit and the edge runtime's memory budget.
const MAX_BASE64_LENGTH = 14_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// Structured output schema — the API guarantees the response matches it.
const LINE_ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'number' },
          is_recoverable: { type: 'boolean' },
        },
        required: ['label', 'amount', 'is_recoverable'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const PROMPT = `You are extracting charge line items from a South African municipal account or body corporate levy statement (City of Johannesburg, City of Cape Town, eThekwini, or similar).

For each individual service charge on the statement, return:
- "label": plain-English name of the charge (e.g. "Electricity", "Water & Sanitation", "Refuse Removal", "Levy", "Sewerage", "Rates", "Gas"). Translate Afrikaans labels (e.g. "Elektrisiteit" → "Electricity", "Water en Riool" → "Water & Sanitation").
- "amount": the rand amount for the current period as a plain number.
- "is_recoverable": true for usage-based charges a tenant normally pays (electricity, water, sanitation, gas, refuse); false for ownership costs (levy, rates, insurance, admin fees).

Rules:
- If one service appears several times (e.g. multiple electricity readings), combine them into one item.
- Use VAT-inclusive totals per service where the statement shows them; do not add separate VAT lines.
- Leave out credits, payments received, previous balances, interest on arrears, and "amount due" summary lines — only current-period service charges.
- If there are no extractable charges, return an empty items list.`;

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  // ── 1. Auth ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ success: false, error: 'Missing authorization header' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ success: false, error: 'Unauthorized' }, 401);

  // ── 2. Parse + validate request ──────────────────────────
  let body: { fileBase64?: unknown; fileName?: unknown; propertyId?: unknown; uploadId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  const { fileBase64, fileName, propertyId, uploadId } = body;

  if (typeof fileBase64 !== 'string' || !fileBase64 || typeof propertyId !== 'string') {
    return json({ success: false, error: 'fileBase64 and propertyId are required' }, 400);
  }
  if (fileBase64.length > MAX_BASE64_LENGTH) {
    return json({ success: false, error: 'PDF is too large (max 10 MB)' }, 413);
  }
  // Cheap magic-number check: base64 of "%PDF" is "JVBER".
  if (!fileBase64.startsWith('JVBER')) {
    return json({ success: false, error: 'File is not a PDF' }, 400);
  }

  // ── 3. Verify property ownership (RLS also enforces this) ─
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!property) return json({ success: false, error: 'Property not found or access denied' }, 403);

  const setUploadStatus = async (fields: Record<string, unknown>) => {
    if (typeof uploadId !== 'string') return;
    await supabase.from('statement_uploads').update(fields).eq('id', uploadId).eq('owner_id', user.id);
  };

  await setUploadStatus({ extraction_status: 'processing' });

  // ── 4. Ask Claude ────────────────────────────────────────
  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: LINE_ITEMS_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    if (response.stop_reason === 'refusal') {
      await setUploadStatus({ extraction_status: 'failed' });
      return json({ success: false, error: 'This document could not be processed. Please add the items manually.' }, 422);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Response truncated (max_tokens)');
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = JSON.parse(text) as { items: { label: string; amount: number; is_recoverable: boolean }[] };

    // Schema guarantees shape; still drop blanks, non-finite and non-positive
    // amounts (the DB rejects negatives) and round to cents.
    const items = parsed.items
      .map((i) => ({ label: i.label.trim(), amount: Math.round(i.amount * 100) / 100, is_recoverable: i.is_recoverable }))
      .filter((i) => i.label && Number.isFinite(i.amount) && i.amount > 0);

    await setUploadStatus({ extraction_status: 'complete', extracted_data: items });

    return json({ success: true, items, count: items.length, fileName });
  } catch (error) {
    // Log details server-side; never echo upstream error bodies to the browser.
    if (error instanceof Anthropic.RateLimitError) {
      console.error('extract-statement: rate limited', error.status);
      await setUploadStatus({ extraction_status: 'failed' });
      return json({ success: false, error: 'The AI service is busy. Please try again in a minute.' }, 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('extract-statement: Anthropic API error', error.status, error.message);
    } else {
      console.error('extract-statement error:', error);
    }
    await setUploadStatus({ extraction_status: 'failed' });
    return json({ success: false, error: 'Extraction failed. Please try again or add the items manually.' }, 502);
  }
});

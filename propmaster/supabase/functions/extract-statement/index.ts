// supabase/functions/extract-statement/index.ts
// Deploy with: supabase functions deploy extract-statement
// Set secret: supabase secrets set ANTHROPIC_API_KEY=your_key_here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── 1. Auth check ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse request ───────────────────────────────────
    const body = await req.json();
    const { fileBase64, fileName, propertyId, uploadId } = body;

    if (!fileBase64 || !propertyId) {
      return new Response(JSON.stringify({ error: 'fileBase64 and propertyId are required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Verify property ownership ───────────────────────
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .eq('owner_id', user.id)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: 'Property not found or access denied' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Update upload status to processing ──────────────
    if (uploadId) {
      await supabase
        .from('statement_uploads')
        .update({ extraction_status: 'processing' })
        .eq('id', uploadId)
        .eq('owner_id', user.id);
    }

    // ── 5. Call Claude API ─────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured in Supabase secrets');
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: fileBase64,
                },
              },
              {
                type: 'text',
                text: `You are extracting utility and levy line items from a South African municipal account or body corporate levy statement (City of Johannesburg, City of Cape Town, eThekwini, or similar).

Extract every individual charge line item from this document.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences. Just the raw JSON array.

Each item must have exactly these fields:
- "label": string — the name of the charge (e.g. "Electricity", "Water & Sanitation", "Refuse Removal", "Levy", "Sewerage", "Rates", "Gas")
- "amount": number — the rand amount as a number (no currency symbols, no commas)
- "is_recoverable": boolean — true if this is a usage-based charge the tenant should pay (electricity, water, gas, refuse), false if it is an ownership cost (levy, rates, insurance, admin fee)

Rules:
- Normalise label names to plain English (e.g. "Elektrisiteit" → "Electricity", "Water en Riool" → "Water & Sanitation")
- If an amount appears as a credit (negative), still include it with the negative value
- Exclude VAT line items — include only the pre-VAT or total-per-service amounts
- If the same service appears multiple times (e.g. multiple electricity readings), sum them into one entry
- Do not include payment totals, previous balance, or "amount due" summary lines — only individual service charges
- If you cannot find any extractable line items, return an empty array []

Example output format:
[{"label":"Electricity","amount":1842.50,"is_recoverable":true},{"label":"Water & Sanitation","amount":634.00,"is_recoverable":true},{"label":"Refuse Removal","amount":195.00,"is_recoverable":true},{"label":"Levy","amount":750.00,"is_recoverable":false}]`,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API returned ${claudeResponse.status}: ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    // ── 6. Parse Claude's response ─────────────────────────
    let extractedItems: { label: string; amount: number; is_recoverable: boolean }[] = [];

    try {
      // Strip any accidental markdown fences just in case
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      extractedItems = JSON.parse(cleaned);

      // Validate shape
      if (!Array.isArray(extractedItems)) throw new Error('Response is not an array');
      extractedItems = extractedItems.filter(item =>
        typeof item.label === 'string' &&
        typeof item.amount === 'number' &&
        typeof item.is_recoverable === 'boolean'
      );
    } catch (parseError) {
      console.error('Failed to parse Claude response:', rawText);
      throw new Error('Claude returned an unexpected format — could not parse line items');
    }

    // ── 7. Update upload record with results ───────────────
    if (uploadId) {
      await supabase
        .from('statement_uploads')
        .update({
          extraction_status: 'complete',
          extracted_data: extractedItems,
        })
        .eq('id', uploadId)
        .eq('owner_id', user.id);
    }

    // ── 8. Return extracted items ──────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        items: extractedItems,
        count: extractedItems.length,
        fileName,
      }),
      {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('extract-statement error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Extraction failed',
        success: false,
      }),
      {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      }
    );
  }
});

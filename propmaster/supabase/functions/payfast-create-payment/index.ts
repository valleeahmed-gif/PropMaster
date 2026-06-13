// supabase/functions/payfast-create-payment/index.ts
// Deploy: supabase functions deploy payfast-create-payment
// Secrets: supabase secrets set PAYFAST_MERCHANT_ID=... PAYFAST_MERCHANT_KEY=... PAYFAST_PASSPHRASE=...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process'; // change to www.payfast.co.za for production

function md5(str: string): string {
  return createHash('md5').update(str).digest('hex');
}

function buildSignature(params: Record<string, string>, passphrase: string): string {
  const ordered = Object.keys(params).sort().reduce<Record<string, string>>((acc, key) => {
    if (key !== 'signature') acc[key] = params[key];
    return acc;
  }, {});
  const queryString = new URLSearchParams(ordered).toString() +
    (passphrase ? `&passphrase=${encodeURIComponent(passphrase)}` : '');
  return md5(queryString);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

    const { invoiceId, returnUrl, cancelUrl } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, leases(tenant_id), properties(name)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID') ?? '';
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY') ?? '';
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://propmaster.co.za/app';

    const params: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl || `${appUrl}/invoices`,
      cancel_url: cancelUrl || `${appUrl}/invoices`,
      notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payfast-itn`,
      amount: invoice.total_amount.toFixed(2),
      item_name: `${invoice.invoice_number} - ${invoice.properties?.name || 'Rental'}`,
      item_description: `Rent invoice for ${invoice.invoice_number}`,
      m_payment_id: invoiceId,
      email_confirmation: '1',
      confirmation_address: user.email || '',
    };

    params.signature = buildSignature(params, passphrase);

    const formHtml = `
      <form id="pf" action="${PAYFAST_URL}" method="POST">
        ${Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join('')}
      </form>
      <script>document.getElementById('pf').submit();</script>
    `;

    return new Response(
      JSON.stringify({ success: true, paymentUrl: PAYFAST_URL, params }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed', success: false }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});

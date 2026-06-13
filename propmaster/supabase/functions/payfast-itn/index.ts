// supabase/functions/payfast-itn/index.ts
// PayFast ITN (Instant Transaction Notification) webhook handler
// Deploy: supabase functions deploy payfast-itn
// Configure ITN URL in PayFast merchant settings:
//   https://cghiodbvbggizghxuvna.supabase.co/functions/v1/payfast-itn

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.168.0/node/crypto.ts';

function md5(str: string): string {
  return createHash('md5').update(str).digest('hex');
}

function verifySignature(params: Record<string, string>, passphrase: string): boolean {
  const sig = params['signature'];
  if (!sig) return false;

  const ordered = Object.keys(params)
    .filter(k => k !== 'signature')
    .sort()
    .reduce<Record<string, string>>((acc, k) => { acc[k] = params[k]; return acc; }, {});

  const queryString = new URLSearchParams(ordered).toString() +
    (passphrase ? `&passphrase=${encodeURIComponent(passphrase)}` : '');
  const expected = md5(queryString);
  return expected === sig;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.text();
    const params: Record<string, string> = {};
    new URLSearchParams(body).forEach((v, k) => { params[k] = v; });

    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
    if (!verifySignature(params, passphrase)) {
      return new Response('Invalid signature', { status: 400 });
    }

    const paymentStatus = params['payment_status'];
    const invoiceId = params['m_payment_id'];
    const payfastPaymentId = params['pf_payment_id'];
    const amount = parseFloat(params['amount_gross'] || '0');

    if (!invoiceId) {
      return new Response('Missing m_payment_id', { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (paymentStatus === 'COMPLETE') {
      // Fetch invoice
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('property_id, lease_id, owner_id')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        // Insert payment record
        await supabaseAdmin.from('payments').insert({
          property_id: invoice.property_id,
          lease_id: invoice.lease_id,
          invoice_id: invoiceId,
          owner_id: invoice.owner_id,
          amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'payfast',
          payfast_payment_id: payfastPaymentId,
          status: 'verified',
          notes: `PayFast payment ${payfastPaymentId}`,
        });

        // Mark invoice paid
        await supabaseAdmin
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', invoiceId);
      }
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('payfast_payment_id', payfastPaymentId);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    return new Response('Internal error', { status: 500 });
  }
});

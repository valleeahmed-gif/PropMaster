// supabase/functions/send-invoice/index.ts
// Deploy: supabase functions deploy send-invoice
// Secret: supabase secrets set RESEND_API_KEY=re_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateZA(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function monthName(month: number): string {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][month - 1];
}

function buildInvoiceHtml(data: {
  invoiceNumber: string;
  month: number;
  year: number;
  dueDate: string;
  createdAt: string;
  lineItems: { description: string; amount: number }[];
  totalAmount: number;
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  tenantEmail: string;
  landlordName: string;
  landlordEmail: string;
}): string {
  const lines = data.lineItems.map(li => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e8e0;font-size:14px;color:#374151;">${li.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e8e0;font-size:14px;color:#374151;text-align:right;font-weight:600;">${formatZAR(li.amount)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:#f2f2ed;font-family:'Nunito Sans',system-ui,sans-serif;}
  .container{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(11,65,56,0.08);}
  .header{background:linear-gradient(135deg,#0e7c64,#0c4f43);padding:32px 32px 28px;color:#fff;}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
  .logo-icon{width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;}
  .header h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;}
  .header p{margin:4px 0 0;opacity:0.75;font-size:13px;}
  .badge{display:inline-block;background:rgba(201,151,42,0.25);color:#f5d07e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.5px;margin-top:16px;}
  .body{padding:28px 32px;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f9f9f6;border-radius:12px;padding:16px;margin-bottom:24px;}
  .meta-item p.label{margin:0;font-size:11px;color:#97a39e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
  .meta-item p.value{margin:4px 0 0;font-size:14px;color:#16201d;font-weight:700;}
  table{width:100%;border-collapse:collapse;}
  thead tr th{background:#f2f2ed;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#97a39e;text-transform:uppercase;letter-spacing:0.5px;}
  thead tr th:last-child{text-align:right;}
  .total-row td{padding:14px 12px;font-size:16px;font-weight:800;color:#16201d;border-top:2px solid #0e7c64;}
  .total-row td:last-child{text-align:right;color:#0e7c64;}
  .footer{background:#f9f9f6;padding:20px 32px;border-top:1px solid #e8e8e0;font-size:12px;color:#97a39e;text-align:center;}
  .footer a{color:#0e7c64;text-decoration:none;font-weight:600;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div>
        <div style="font-weight:800;font-size:18px;">PropMaster</div>
        <div style="opacity:0.65;font-size:12px;">Property Management</div>
      </div>
    </div>
    <h1 style="margin:0;font-size:22px;">Tax Invoice</h1>
    <p style="margin:4px 0 0;opacity:0.75;font-size:13px;">${data.propertyName}</p>
    <div class="badge">${data.invoiceNumber}</div>
  </div>

  <div class="body">
    <!-- Parties -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <div>
        <p style="margin:0 0 4px;font-size:11px;color:#97a39e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">From</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#16201d;">${data.landlordName}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#5d6b66;">${data.landlordEmail}</p>
      </div>
      <div>
        <p style="margin:0 0 4px;font-size:11px;color:#97a39e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">To</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#16201d;">${data.tenantName}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#5d6b66;">${data.tenantEmail}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#97a39e;">${data.propertyAddress}</p>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta-grid">
      <div class="meta-item"><p class="label">Period</p><p class="value">${monthName(data.month)} ${data.year}</p></div>
      <div class="meta-item"><p class="label">Due Date</p><p class="value">${formatDateZA(data.dueDate)}</p></div>
      <div class="meta-item"><p class="label">Invoice Date</p><p class="value">${formatDateZA(data.createdAt?.split('T')[0] || '')}</p></div>
      <div class="meta-item"><p class="label">Invoice #</p><p class="value">${data.invoiceNumber}</p></div>
    </div>

    <!-- Line items -->
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>Total Due</td>
          <td>${formatZAR(data.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #86efac;">
      <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">Payment instructions</p>
      <p style="margin:6px 0 0;font-size:13px;color:#166534;">
        Please pay via EFT and use your invoice number <strong>${data.invoiceNumber}</strong> as the payment reference.
        Contact your landlord at <a href="mailto:${data.landlordEmail}" style="color:#0e7c64;">${data.landlordEmail}</a> once payment is made.
      </p>
    </div>
  </div>

  <div class="footer">
    Generated by <a href="https://propmaster.co.za">PropMaster</a> · South African Property Management
  </div>
</div>
</body>
</html>`;
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

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('owner_id', user.id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch property
    const { data: property } = await supabase
      .from('properties')
      .select('name, address, city, unit_number')
      .eq('id', invoice.property_id)
      .single();

    // Fetch lease → tenant
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant_id')
      .eq('id', invoice.lease_id)
      .single();

    const { data: tenant } = lease
      ? await supabase.from('tenants').select('name, email').eq('id', lease.tenant_id).single()
      : { data: null };

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('RESEND_API_KEY is not configured');

    const landlordName = user.user_metadata?.name || user.email || 'Your Landlord';
    const propertyAddress = property
      ? `${property.address}${property.unit_number ? `, Unit ${property.unit_number}` : ''}, ${property.city}`
      : '';

    const html = buildInvoiceHtml({
      invoiceNumber: invoice.invoice_number,
      month: invoice.month,
      year: invoice.year,
      dueDate: invoice.due_date,
      createdAt: invoice.created_at,
      lineItems: invoice.line_items || [],
      totalAmount: invoice.total_amount,
      propertyName: property?.name || 'Property',
      propertyAddress,
      tenantName: tenant?.name || 'Tenant',
      tenantEmail: tenant?.email || '',
      landlordName,
      landlordEmail: user.email || '',
    });

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `PropMaster <invoices@propmaster.co.za>`,
        to: [tenant?.email || user.email],
        subject: `Invoice ${invoice.invoice_number} — ${property?.name || 'Your rental'} — Due ${formatDateZA(invoice.due_date)}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Resend error: ${errText}`);
    }

    // Mark invoice as sent
    await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoiceId);

    return new Response(
      JSON.stringify({ success: true, sentTo: tenant?.email }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send invoice', success: false }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});

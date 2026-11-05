// Cloudflare Worker entry — serves the Vite build from the [assets] binding
// with SPA fallback for the two entry points:
//   /            → dist/index.html        (marketing landing page)
//   /app, /app/* → dist/app/index.html    (React SPA, basename="/app")
//
// Static files that exist are served straight from the asset store (with
// headers from public/_headers); this Worker only runs for paths that are
// NOT files, so it decides the fallbacks. There is deliberately no
// `_redirects` file: a catch-all rewrite there would also rewrite real asset
// requests to HTML and break the app.

const SUPABASE = 'https://cghiodbvbggizghxuvna.supabase.co';

// Keep in sync with public/_headers.
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://d8j0ntlcm91z4.cloudfront.net",
    `connect-src 'self' ${SUPABASE} ${SUPABASE.replace('https://', 'wss://')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function withHeaders(response, extra = {}) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.headers.set(k, v);
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Legacy bare auth paths → /app-prefixed routes (old bookmarks/links).
    if (pathname === '/login' || pathname === '/signup' || pathname === '/accept-invite') {
      return Response.redirect(new URL('/app' + pathname + url.search, url.origin).toString(), 301);
    }

    // 1. Serve the real file if one exists.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;

    // 2. A missing hashed build file must stay a 404. Answering with HTML
    //    makes the browser fail with a MIME error; a 404 lets the app detect
    //    a stale tab and reload onto the new build.
    if (pathname.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(pathname)) {
      return withHeaders(new Response('Not found', { status: 404 }), { 'Cache-Control': 'no-store' });
    }

    // 3. SPA fallback: serve the right shell with 200 (not a redirect) so the
    //    deep-link URL is preserved for the client router.
    const shell = pathname === '/app' || pathname.startsWith('/app/') ? '/app/' : '/';
    const shellResponse = await env.ASSETS.fetch(new URL(shell, url.origin));
    return withHeaders(shellResponse, { 'Cache-Control': 'no-cache' });
  },
};

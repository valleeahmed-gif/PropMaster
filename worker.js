// Cloudflare Worker entry — serves static assets from the [assets] binding
// with correct SPA fallback for a two-entry-point build:
//   /            → dist/index.html        (marketing landing page)
//   /app, /app/* → dist/app/index.html    (React SPA, basename="/app")
//
// This worker is the SINGLE source of truth for routing. We intentionally do
// NOT ship a `_redirects` file: a catch-all `/*  /  200` rewrite there also
// rewrites real asset requests (e.g. /assets/app-*.js) to the landing-page
// HTML, so the browser receives HTML where it expects JavaScript, the React
// app fails to boot, and /app/* renders blank. Letting the worker serve assets
// first and only fall back to a shell on a genuine 404 avoids that entirely.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // 0. Legacy bare auth paths → /app-prefixed routes.
    //    Keeps old bookmarks / links from the marketing page working.
    if (pathname === '/login' || pathname === '/signup') {
      return Response.redirect(new URL('/app' + pathname, url.origin).toString(), 301);
    }

    // 1. Serve the real asset if one exists (js, css, images, html shells, …).
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // 2. No matching file → SPA fallback. Serve the correct shell with a 200
    //    (NOT a redirect) so the original deep-link URL is preserved and the
    //    client-side router can read it. We fetch the canonical trailing-slash
    //    path so html_handling="auto-trailing-slash" returns the file content
    //    directly instead of a 301 to the slash form.
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      // React app deep link (e.g. /app/signup, /app/login, /app/tenant/home).
      return env.ASSETS.fetch(new URL('/app/', url.origin));
    }

    // 3. Everything else → landing page.
    return env.ASSETS.fetch(new URL('/', url.origin));
  },
};

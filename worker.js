// Cloudflare Worker entry — serves static assets from the [assets] binding
// with correct SPA fallback for a two-entry-point build:
//   /            → dist/index.html        (marketing landing page)
//   /app, /app/* → dist/app/index.html    (React SPA, basename="/app")
//
// We try the asset first; if it's a navigation request with no matching file,
// we fall back to the right index.html so client-side routing can take over.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Try to serve the exact asset (js, css, images, the html files, etc.)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // 2. No exact file. Decide which SPA shell to serve.
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      // React app deep link (e.g. /app/login, /app/tenant/home) → app shell
      return env.ASSETS.fetch(new URL('/app/index.html', url.origin));
    }

    // 3. Everything else → landing page
    return env.ASSETS.fetch(new URL('/index.html', url.origin));
  },
};

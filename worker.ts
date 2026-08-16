export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The current GeoSurvey backend is an Express/Node server and is kept
    // intact. This Worker currently serves the Vite application shell/assets.
    // API routes will be connected separately rather than silently dropping
    // the existing server functionality.
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'GeoSurvey API is not connected to this Cloudflare deployment yet.'
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        }
      );
    }

    return env.ASSETS.fetch(request);
  }
};

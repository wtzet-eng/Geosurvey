export interface Env {
  ASSETS: Fetcher;
  API_BACKEND_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Forward API requests to the existing Node/Express backend when a
    // backend URL is configured. The Vite frontend remains on Cloudflare.
    if (url.pathname.startsWith('/api/')) {
      if (!env.API_BACKEND_URL) {
        return new Response(
          JSON.stringify({
            error: 'GeoSurvey API is not configured.',
            message: 'Set API_BACKEND_URL to the deployed GeoSurvey backend URL.'
          }),
          {
            status: 503,
            headers: { 'content-type': 'application/json; charset=utf-8' }
          }
        );
      }

      const backend = new URL(env.API_BACKEND_URL);
      backend.pathname = url.pathname;
      backend.search = url.search;

      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', url.host);
      headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      try {
        return await fetch(backend, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'follow'
        });
      } catch (error) {
        console.error('GeoSurvey API proxy error:', error);
        return new Response(
          JSON.stringify({ error: 'GeoSurvey API backend is unavailable.' }),
          {
            status: 502,
            headers: { 'content-type': 'application/json; charset=utf-8' }
          }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};

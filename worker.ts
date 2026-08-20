interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetFetcher;
  API_BACKEND_URL?: string;
}

function jsonError(status: number, error: string, message?: string): Response {
  return new Response(JSON.stringify({ error, ...(message ? { message } : {}) }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (!env.API_BACKEND_URL) {
      return jsonError(
        503,
        'GeoSurvey API is not configured.',
        'Set API_BACKEND_URL to the deployed GeoSurvey backend URL.'
      );
    }

    let backendBase: URL;
    try {
      backendBase = new URL(env.API_BACKEND_URL);
    } catch {
      return jsonError(500, 'Invalid API_BACKEND_URL configuration.');
    }

    const backend = new URL(backendBase.toString());
    backend.pathname = url.pathname;
    backend.search = url.search;

    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
    headers.delete('content-length');
    headers.delete('host');

    try {
      const response = await fetch(new Request(backend.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'follow'
      }));

      return response;
    } catch (error) {
      console.error('GeoSurvey API proxy error:', error);
      return jsonError(502, 'GeoSurvey API backend is unavailable.');
    }
  }
};

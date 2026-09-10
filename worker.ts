import { httpServerHandler } from 'cloudflare:node';
import { app } from './server.cloudflare';

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetFetcher;
}

type WorkerLikeHandler = {
  fetch(request: Request, env?: unknown, ctx?: unknown): Promise<Response> | Response;
};

const PORT = 3000;
app.listen(PORT);
const apiHandler = httpServerHandler({ port: PORT }) as unknown as WorkerLikeHandler;

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return await apiHandler.fetch(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  }
};

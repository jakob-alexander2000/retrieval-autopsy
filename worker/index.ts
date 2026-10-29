import { handleAnswer, type Env } from "./answer";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/answer") return handleAnswer(request, env);
    return env.ASSETS.fetch(request);
  },
};

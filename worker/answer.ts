import { createLimiter } from "./rate-limit";

export const MODEL = "@cf/meta/llama-3.1-8b-instruct";

export type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

export type Env = {
  ASSETS: { fetch: (input: Request) => Promise<Response> };
  AI?: AiBinding;
};

const limiter = createLimiter(8, 60_000);
const MAX_BODY = 32_000;

export function readModelText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.response === "string") return record.response.trim();
  if (typeof record.result === "string") return record.result.trim();
  if (typeof record.text === "string") return record.text.trim();
  if (record.result && typeof record.result === "object") {
    return readModelText(record.result);
  }
  return "";
}

function json(body: unknown, status: number, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

export async function handleAnswer(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!limiter.allow(clientKey(request), now)) {
    return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!payload || typeof payload !== "object") return json({ error: "bad_json" }, 400);
  const body = payload as { question?: unknown; passages?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const passages = Array.isArray(body.passages)
    ? body.passages.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
  if (!question || question.length > 800 || passages.length === 0 || passages.some((p) => p.length > 2500)) {
    return json({ error: "bad_request" }, 400);
  }
  if (!env.AI) return json({ error: "ai_unavailable" }, 503);
  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Answer from the passages only. Keep every condition, number, and limit that the passages state. If the passages do not say, say that they do not say.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nPassages:\n${passages.map((passage, index) => `[${index + 1}] ${passage}`).join("\n\n")}`,
        },
      ],
      max_tokens: 280,
    });
    const answer = readModelText(result);
    if (!answer) return json({ error: "ai_unavailable" }, 503);
    console.log(JSON.stringify({ event: "answer", status: 200, chars: answer.length }));
    return json({ answer, model: MODEL }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    console.log(JSON.stringify({ event: "answer_error", message }));
    return json({ error: "ai_unavailable" }, 503);
  }
}

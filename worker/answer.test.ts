import { describe, expect, it } from "vitest";
import { handleAnswer, readModelText, type Env } from "./answer";
import { allow } from "./rate-limit";

function post(body: unknown, ip = "203.0.113.5"): Request {
  return new Request("https://example.test/api/answer", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

describe("readModelText", () => {
  it("reads the shapes the binding returns", () => {
    expect(readModelText({ response: " Kept. " })).toBe("Kept.");
    expect(readModelText({ result: { response: "Nested." } })).toBe("Nested.");
    expect(readModelText("Plain.")).toBe("Plain.");
    expect(readModelText({})).toBe("");
  });
});

describe("rate limit", () => {
  it("allows eight calls in a window and blocks the ninth", () => {
    let hits: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const decision = allow(1_000 + i, hits, 60_000, 8);
      expect(decision.ok).toBe(true);
      hits = decision.hits;
    }
    expect(allow(1_100, hits, 60_000, 8).ok).toBe(false);
    expect(allow(61_100, hits, 60_000, 8).ok).toBe(true);
  });
});

describe("POST /api/answer", () => {
  const passages = ["Full-time employees only receive 30 days of paid annual leave after the probation period."];

  it("returns 503 when no model is bound", async () => {
    const env: Env = { ASSETS: { fetch: async () => new Response("asset") } };
    const response = await handleAnswer(post({ question: "How many days?", passages }), env, 10);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ai_unavailable" });
  });

  it("returns the model text when the binding works", async () => {
    const env: Env = {
      ASSETS: { fetch: async () => new Response("asset") },
      AI: { run: async () => ({ response: "Employees receive 30 days." }) },
    };
    const response = await handleAnswer(post({ question: "How many days?", passages }, "198.51.100.4"), env, 20);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string };
    expect(body.answer).toBe("Employees receive 30 days.");
  });

  it("rejects a bad body", async () => {
    const env: Env = { ASSETS: { fetch: async () => new Response("asset") } };
    const response = await handleAnswer(post({ question: "" }, "198.51.100.8"), env, 30);
    expect(response.status).toBe(400);
  });

  it("rate limits a single address", async () => {
    const env: Env = {
      ASSETS: { fetch: async () => new Response("asset") },
      AI: { run: async () => ({ response: "ok" }) },
    };
    let status = 200;
    for (let i = 0; i < 9; i += 1) {
      const response = await handleAnswer(
        post({ question: "How many days?", passages }, "198.51.100.20"),
        env,
        5_000 + i,
      );
      status = response.status;
    }
    expect(status).toBe(429);
  });
});

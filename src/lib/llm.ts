/**
 * Provider-agnostic LLM core for VisionCut AI (script/storyboard generation).
 *
 * Mirrors src/lib/transcribe.ts: the text-generation backend is selected via
 * env vars so the same build works in the Z.ai sandbox (platform SDK) and on
 * any hosting with a bring-your-own key (any OpenAI-compatible
 * chat-completions host).
 *
 * Env vars:
 *   SCRIPT_PROVIDER     auto (default) | zai | custom
 *   CUSTOM_LLM_BASE_URL any OpenAI-compatible chat-completions host (custom)
 *   CUSTOM_LLM_API_KEY  API key for `custom`
 *   CUSTOM_LLM_MODEL    model id for `custom`
 *
 * `auto` resolution order:
 *   1. `custom` when CUSTOM_LLM_BASE_URL (+ key) are set
 *   2. `zai` when a Z.ai platform config is available (sandbox)
 *   3. otherwise a clear error explaining what to configure
 *
 * When a provider is pinned (custom/zai) it is used exclusively;
 * in `auto` mode a failing provider falls through to the next candidate.
 */

import ZAI from "z-ai-web-dev-sdk";

export type LlmProvider = "auto" | "zai" | "custom";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  content: string;
  provider: "zai" | "custom";
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export class LlmError extends Error {
  status: number;
  provider: string;
  constructor(message: string, status = 502, provider = "llm") {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.provider = provider;
  }
}

const DEFAULT_TIMEOUT_MS = 100_000;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export interface LlmDiagnostics {
  provider: string;
  custom: { hasKey: boolean; hasBaseUrl: boolean; model: string };
  zai: { available: boolean };
}

/** Masked diagnostics for a GET /health-style endpoint (never leaks the key). */
export function llmDiagnostics(): LlmDiagnostics {
  return {
    provider: env("SCRIPT_PROVIDER") || "auto",
    custom: {
      hasKey: !!env("CUSTOM_LLM_API_KEY"),
      hasBaseUrl: !!env("CUSTOM_LLM_BASE_URL"),
      model: env("CUSTOM_LLM_MODEL") || "(default)",
    },
    zai: { available: true },
  };
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible chat completions (custom host)                    */
/* ------------------------------------------------------------------ */

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number | string };
}

async function chatCompletionViaOpenAICompat(
  opts: {
    provider: "custom";
    baseUrl: string;
    apiKey: string;
    model: string;
    messages: LlmMessage[];
    temperature?: number;
  },
): Promise<LlmResult> {
  const { provider, baseUrl, apiKey, model, messages } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      }),
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new LlmError(
      aborted
        ? `${provider} request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s. Try a shorter script or a faster model.`
        : `Could not reach ${provider} (${baseUrl}). Check network/base URL.`,
      aborted ? 504 : 502,
      provider,
    );
  } finally {
    clearTimeout(timer);
  }

  let body: OpenAIChatResponse | null = null;
  let rawSnippet = "";
  try {
    rawSnippet = await res.text();
    body = JSON.parse(rawSnippet) as OpenAIChatResponse;
  } catch {
    /* keep snippet */
  }

  if (!res.ok) {
    const detail = (body?.error?.message || rawSnippet).slice(0, 220).replace(/\s+/g, " ");
    const map: Record<number, [number, string]> = {
      401: [502, `The ${provider} API key was rejected (401). Check the API key.`],
      402: [402, `${provider} account has insufficient credits for this model (402).`],
      403: [502, `The ${provider} key is not allowed for this request (403). Check key privacy/moderation settings.`],
      404: [502, `${provider} model or endpoint not found (404). Verify the model id.`],
      408: [504, `${provider} upstream timeout (408). Try again or pick a faster model.`],
      429: [429, `${provider} rate limit exceeded (429). Free models have daily caps — retry shortly or top up credits.`],
    };
    const mapped = map[res.status];
    if (mapped) throw new LlmError(`${mapped[1]} ${detail}`.trim(), mapped[0], provider);
    throw new LlmError(
      `${provider} request failed (HTTP ${res.status}). ${detail}`.trim(),
      502,
      provider,
    );
  }

  const content = body?.choices?.[0]?.message?.content || "";
  if (!content.trim()) {
    throw new LlmError(
      `${provider} returned an empty completion (finish_reason=${body?.choices?.[0]?.finish_reason ?? "unknown"}).`,
      502,
      provider,
    );
  }
  return {
    content,
    provider,
    model,
    usage: body?.usage
      ? {
          promptTokens: body.usage.prompt_tokens,
          completionTokens: body.usage.completion_tokens,
          totalTokens: body.usage.total_tokens,
        }
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Z.ai platform SDK (sandbox)                                         */
/* ------------------------------------------------------------------ */

async function chatCompletionViaZai(messages: LlmMessage[], temperature?: number): Promise<LlmResult> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    throw new LlmError(
      "Script generation has no LLM provider on this server (the built-in engine only works in its own sandbox). " +
        "Configure any OpenAI-compatible host: SCRIPT_PROVIDER=custom + CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY (+ CUSTOM_LLM_MODEL).",
      503,
      "zai",
    );
  }
  const completion = await zai.chat.completions.create({
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    thinking: { type: "disabled" },
    ...(typeof temperature === "number" ? { temperature } : {}),
  });
  const content = completion.choices[0]?.message?.content || "";
  if (!content.trim()) throw new LlmError("Z.ai returned an empty completion.", 502, "zai");
  return { content, provider: "zai", model: "zai-platform-chat" };
}

/* ------------------------------------------------------------------ */
/* Resolution chain                                                    */
/* ------------------------------------------------------------------ */

function providerOrder(selected: LlmProvider): Array<"custom" | "zai"> {
  if (selected === "custom") return ["custom"];
  if (selected === "zai") return ["zai"];
  // auto: custom (if base url) -> zai (sandbox)
  const order: Array<"custom" | "zai"> = [];
  if (env("CUSTOM_LLM_BASE_URL")) order.push("custom");
  order.push("zai");
  return order;
}

async function tryProvider(
  provider: "custom" | "zai",
  messages: LlmMessage[],
  temperature?: number,
): Promise<LlmResult> {
  if (provider === "custom") {
    const key = env("CUSTOM_LLM_API_KEY") || "";
    return chatCompletionViaOpenAICompat({
      provider: "custom",
      baseUrl: (env("CUSTOM_LLM_BASE_URL") || "").replace(/\/+$/, ""),
      apiKey: key,
      model: env("CUSTOM_LLM_MODEL") || "default",
      messages,
      temperature,
    });
  }
  return chatCompletionViaZai(messages, temperature);
}

/**
 * Generate a chat completion using the configured provider chain.
 * In `auto` mode a provider failure (except 4xx config errors like 402/429)
 * falls through to the next candidate; pinned providers surface errors as-is.
 */
export async function generateChatCompletion(
  messages: LlmMessage[],
  opts: { temperature?: number } = {},
): Promise<LlmResult> {
  const selected = (env("SCRIPT_PROVIDER") as LlmProvider | undefined) || "auto";
  const order = providerOrder(selected);
  const pinned = selected !== "auto";
  let lastError: LlmError | null = null;

  for (const provider of order) {
    try {
      return await tryProvider(provider, messages, opts.temperature);
    } catch (err) {
      const le = err instanceof LlmError ? err : new LlmError(String(err), 502, provider);
      lastError = le;
      // Auth/billing/rate-limit errors on the pinned provider should stop immediately.
      if (pinned) throw le;
      if (le.status === 429) throw le; // don't silently burn the fallback on rate limits
      console.warn(`[llm] provider ${provider} failed (status ${le.status}), trying next...`);
    }
  }
  throw lastError || new LlmError("No LLM provider is configured.", 503);
}

/* ------------------------------------------------------------------ */
/* Robust JSON extraction (reasoning models may emit <think> / fences) */
/* ------------------------------------------------------------------ */

/**
 * Extract the first parseable JSON object from model output.
 * Handles <think> blocks, markdown fences and surrounding prose.
 */
export function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  // 1. Strip reasoning-model <think>/<thinking> blocks entirely.
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  // 2. Strip markdown code fences.
  text = text.replace(/```(?:json)?/gi, "");
  // 3. Try the whole string first (strict JSON models).
  const attempts: string[] = [text.trim()];
  // 4. Greedy first-{ to last-} span (works for a single top-level object).
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* next attempt */
    }
  }
  return null;
}

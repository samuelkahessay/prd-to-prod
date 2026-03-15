const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are a product requirements analyst. Your job is to help users refine vague ideas into specific, actionable PRDs (Product Requirements Documents).

## Your Process

1. Read the user's input carefully
2. If the input is too vague to build from, ask ONE focused follow-up question
3. After 2-5 exchanges, when you have enough detail, synthesize a complete PRD

## What Makes a PRD "Ready"

A PRD is ready when it has:
- A clear title
- A problem statement (what pain does this solve?)
- Target users (who is this for?)
- Core features (3-7 specific, buildable features)
- Acceptance criteria (how do we know it's done?)

## Response Format

Always respond with valid JSON in this exact shape:

{
  "status": "needs_input" or "ready",
  "message": "Your conversational response to the user",
  "question": "Your follow-up question (only if status is needs_input)",
  "prd": null or {
    "title": "Product title",
    "problem": "Problem statement",
    "users": "Target users description",
    "features": ["Feature 1", "Feature 2", ...],
    "criteria": ["Criterion 1", "Criterion 2", ...]
  }
}

When status is "needs_input", include a question. When status is "ready", include the prd object.

## Guidelines

- Ask about the MOST important missing piece first
- Don't ask more than 5 questions total — synthesize with what you have
- Be concise — each response should be 2-3 sentences plus the question
- If the user provides a detailed PRD upfront, you can go straight to "ready"`;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "prd_refinement",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["needs_input", "ready"],
          description: "Whether the PRD still needs another question or is ready to finalize.",
        },
        message: {
          type: "string",
          description: "The assistant's conversational response shown in the UI.",
        },
        question: {
          type: ["string", "null"],
          description: "The next follow-up question when more input is required.",
        },
        prd: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                problem: { type: "string" },
                users: { type: "string" },
                features: {
                  type: "array",
                  items: { type: "string" },
                },
                criteria: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["title", "problem", "users", "features", "criteria"],
            },
          ],
        },
      },
      required: ["status", "message", "question", "prd"],
      allOf: [
        {
          if: {
            properties: {
              status: { const: "needs_input" },
            },
          },
          then: {
            properties: {
              question: { type: "string" },
              prd: { type: "null" },
            },
          },
        },
        {
          if: {
            properties: {
              status: { const: "ready" },
            },
          },
          then: {
            properties: {
              question: { type: "null" },
              prd: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  problem: { type: "string" },
                  users: { type: "string" },
                  features: {
                    type: "array",
                    items: { type: "string" },
                  },
                  criteria: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["title", "problem", "users", "features", "criteria"],
              },
            },
          },
        },
      ],
    },
  },
};

function createLLMClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  function buildRequestBody(messages, stream) {
    return {
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: MAX_TOKENS,
      stream,
      response_format: RESPONSE_FORMAT,
      provider: {
        require_parameters: true,
      },
    };
  }

  async function streamChat(messages, onChunk) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://prd-to-prod.vercel.app",
        "X-Title": "prd-to-prod",
      },
      body: JSON.stringify(buildRequestBody(messages, true)),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${body}`);
    }

    if (!res.body) {
      throw new Error("OpenRouter returned an empty streaming response");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSSEBuffer(buffer, (payload) => {
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
        } catch {
          // skip malformed chunks
        }
      });
    }

    return fullContent;
  }

  async function chat(messages) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://prd-to-prod.vercel.app",
        "X-Title": "prd-to-prod",
      },
      body: JSON.stringify(buildRequestBody(messages, false)),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  function parseResponse(content) {
    const parsed = JSON.parse(extractJsonString(content));
    validateParsedResponse(parsed);
    return parsed;
  }

  return { streamChat, chat, parseResponse };
}

function consumeSSEBuffer(buffer, onPayload) {
  const lines = buffer.split("\n");
  const nextBuffer = lines.pop() || "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) continue;
    const payload = trimmed.slice(6);
    if (payload === "[DONE]") continue;
    onPayload(payload);
  }

  return nextBuffer;
}

function extractJsonString(content) {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return content.trim();
}

function validateParsedResponse(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Structured LLM response was not a JSON object");
  }

  const hasValidStatus =
    parsed.status === "needs_input" || parsed.status === "ready";
  if (!hasValidStatus || typeof parsed.message !== "string") {
    throw new Error("Structured LLM response was missing required fields");
  }

  if (parsed.status === "needs_input") {
    if (typeof parsed.question !== "string" || parsed.prd !== null) {
      throw new Error("Structured LLM response did not match needs_input schema");
    }
    return;
  }

  const prd = parsed.prd;
  const validPrd =
    prd &&
    typeof prd === "object" &&
    typeof prd.title === "string" &&
    typeof prd.problem === "string" &&
    typeof prd.users === "string" &&
    Array.isArray(prd.features) &&
    prd.features.every((feature) => typeof feature === "string") &&
    Array.isArray(prd.criteria) &&
    prd.criteria.every((criterion) => typeof criterion === "string");

  if (parsed.question !== null || !validPrd) {
    throw new Error("Structured LLM response did not match ready schema");
  }
}

module.exports = { createLLMClient };

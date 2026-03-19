const { createLLMClient } = require("../lib/llm");

describe("createLLMClient", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.LLM_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
    if (originalModel === undefined) {
      delete process.env.LLM_MODEL;
    } else {
      process.env.LLM_MODEL = originalModel;
    }
    jest.restoreAllMocks();
  });

  test("sends a strict JSON schema request to OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.LLM_MODEL;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"status":"needs_input","message":"Need one more detail.","question":"Who is this for?","prd":null}',
            },
          },
        ],
      }),
    });

    const client = createLLMClient();
    const content = await client.chat([{ role: "user", content: "Build me a CRM" }]);
    const request = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(content).toContain('"status":"needs_input"');
    expect(request.model).toBe("z-ai/glm-5");
    expect(request.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "prd_refinement",
        strict: true,
      },
    });
    expect(request.provider).toEqual({ require_parameters: true });
  });

  test("parseResponse accepts valid structured output and rejects malformed fallback prose", () => {
    const client = createLLMClient();

    expect(
      client.parseResponse(
        '{"status":"ready","message":"Ready to build.","question":null,"prd":{"title":"Test","problem":"Pain","users":"Teams","features":["A"],"criteria":["B"]}}'
      )
    ).toEqual({
      status: "ready",
      message: "Ready to build.",
      question: null,
      prd: {
        title: "Test",
        problem: "Pain",
        users: "Teams",
        features: ["A"],
        criteria: ["B"],
      },
    });

    expect(() => client.parseResponse("Sure, here's a rough draft.")).toThrow();
  });
});

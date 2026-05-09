import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { handle } from "hono/vercel";

export const runtime = "nodejs";

const requestedModel = process.env.COPILOT_MODEL?.trim();
const openaiKey = process.env.OPENAI_API_KEY?.trim();
const googleKey = process.env.GOOGLE_API_KEY?.trim();
const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

function resolveModelAndKey() {
  if (requestedModel?.startsWith("google/") && googleKey) {
    return { model: requestedModel, apiKey: googleKey };
  }

  if (requestedModel?.startsWith("anthropic/") && anthropicKey) {
    return { model: requestedModel, apiKey: anthropicKey };
  }

  if (requestedModel?.startsWith("openai/") && openaiKey) {
    return { model: requestedModel, apiKey: openaiKey };
  }

  if (googleKey) return { model: "google/gemini-2.5-flash", apiKey: googleKey };
  if (openaiKey) return { model: "openai/gpt-4o-mini", apiKey: openaiKey };
  if (anthropicKey) {
    return { model: "anthropic/claude-3.5-haiku", apiKey: anthropicKey };
  }

  return { model: requestedModel || "openai/gpt-4o-mini", apiKey: undefined };
}

const { model, apiKey } = resolveModelAndKey();

const buildPuppetAgent = () =>
  new BuiltInAgent({
    model,
    apiKey,
    maxSteps: 2,
    prompt: `
You are the MindfulLive CopilotKit puppet runtime.

Gemini Live is the sole conversational brain. Do not initiate wellness planning or chat behavior.
Your job is to make registered frontend tools, HITL tools, and A2UI rendering available to the client.
If invoked directly, answer briefly and defer to the voice session.
`,
    tools: [],
  });

const runtimeInstance = new CopilotRuntime({
  agents: {
    default: buildPuppetAgent(),
    wellness_ui: buildPuppetAgent(),
  },
  debug:
    process.env.NODE_ENV === "production"
      ? false
      : { events: true, lifecycle: true, verbose: false },
  runner: new InMemoryAgentRunner(),
  openGenerativeUI: true,
  a2ui: {
    injectA2UITool: true,
  },
});

const app = createCopilotEndpoint({
  runtime: runtimeInstance,
  basePath: "/api/copilotkit",
  mode: "multi-route",
});

export const GET = handle(app);
export const POST = handle(app);

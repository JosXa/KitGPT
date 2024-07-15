// noinspection JSArrowFunctionBracesCanBeRemoved

import "@johnlindquist/kit"
import type { EnvConfig } from "@johnlindquist/kit/types/kit"
import { type LanguageModel, generateText } from "ai"
import { currentModel } from "../store/settings"
import { typedObjectValues } from "../utils/typed-objects"

export const PROVIDERS = {
  "openai.chat": {
    name: "OpenAI",
    getModel: async (modelId: string, baseUrl?: string) =>
      (await import("@ai-sdk/openai")).createOpenAI({ compatibility: "strict", baseUrl })(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/openai/src/openai-chat-settings.ts
    knownModels: [
      "gpt-4o",
      "gpt-4o-2024-05-13",
      "gpt-4-turbo",
      "gpt-4-turbo-2024-04-09",
      "gpt-4-turbo-preview",
      "gpt-4-0125-preview",
      "gpt-4-1106-preview",
      "gpt-4-vision-preview",
      "gpt-4",
      "gpt-4-0613",
      "gpt-4-32k",
      "gpt-4-32k-0613",
      "gpt-3.5-turbo-0125",
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-1106",
      "gpt-3.5-turbo-16k",
      "gpt-3.5-turbo-0613",
      "gpt-3.5-turbo-16k-0613",
    ],
    async ensureAuthenticated(props) {
      await env("OPENAI_API_KEY", {
        hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
        ...props,
      })
    },
    platformStatisticsUrl: "https://platform.openai.com/usage",
  },
  "anthropic.messages": {
    name: "Anthropic",
    getModel: async (modelId: string) => (await import("@ai-sdk/anthropic")).anthropic(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/anthropic/src/anthropic-messages-settings.ts
    knownModels: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
    async ensureAuthenticated(props) {
      await env("ANTHROPIC_API_KEY", {
        hint: `Grab a key from <a href="https://console.anthropic.com/settings/keys">here</a>`,
        ...props,
      })
    },
    platformStatisticsUrl: undefined,
  },
  "google.generative-ai": {
    name: "Google",
    getModel: async (modelId: string) => (await import("@ai-sdk/google")).google(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/google/src/google-generative-ai-settings.ts
    knownModels: [
      "models/gemini-1.5-flash-latest",
      "models/gemini-1.5-pro-latest",
      "models/gemini-pro",
      "models/gemini-pro-vision",
    ],
    async ensureAuthenticated(props) {
      await env("GOOGLE_GENERATIVE_AI_API_KEY", {
        hint: `Grab a key from <a href="https://aistudio.google.com/app/apikey">here</a>`,
        ...props,
      })
    },
    platformStatisticsUrl: "https://aistudio.google.com/app/plan_information",
  },
  "google-vertex": {
    name: "Google Vertex",
    getModel: async (modelId: string) => (await import("@ai-sdk/google-vertex")).vertex(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/google-vertex/src/google-vertex-settings.ts
    knownModels: ["gemini-1.0-pro", "gemini-1.0-pro-vision"],
    async ensureAuthenticated(props) {
      await env("GOOGLE_VERTEX_API_KEY", {
        hint: "Enter the Google Vertex API key",
        ...props,
      })
      await env("GOOGLE_VERTEX_PROJECT", {
        hint: "Please provide the Vertex project name",
        ...props,
      })
      await env("GOOGLE_VERTEX_LOCATION", {
        hint: "Please provide the Vertex location setting",
        ...props,
      })
    },
    platformStatisticsUrl: undefined,
  },
  "mistral.chat": {
    name: "Mistral",
    getModel: async (modelId: string) => (await import("@ai-sdk/mistral")).mistral(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/mistral/src/mistral-chat-settings.ts
    knownModels: [
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b",
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
    ],
    async ensureAuthenticated(props) {
      await env("MISTRAL_API_KEY", {
        hint: `Grab a key from <a href="https://console.mistral.ai/api-keys/">here</a>`,
        ...props,
      })
    },
    platformStatisticsUrl: undefined,
  },
} as const satisfies {
  [key: string]: {
    name: string
    getModel: (modelId: string) => Promise<LanguageModel>
    knownModels: string[]
    ensureAuthenticated: (envOptions: Omit<EnvConfig, "hint">) => Promise<void>
    platformStatisticsUrl: string | undefined
  }
}

export const ALL_PROVIDER_NAMES = typedObjectValues(PROVIDERS).map((p) => p.name)

export type Provider = keyof typeof PROVIDERS

export const getProviderOrThrow = (provider: Provider) => {
  const res = PROVIDERS[provider]
  if (!res) {
    throw Error(`Provider '${provider}' is not implemented`)
  }
  return res
}

export async function getModel(provider: Provider, modelId: string) {
  const p = getProviderOrThrow(provider)
  return await p.getModel(modelId)
}

export async function testProvider() {
  try {
    const result = await generateText({
      model: currentModel.value!,
      messages: [{ role: "user", content: 'Please respond "I am online." and say nothing else!' }],
    })
    return { ok: result.text.length > 0, error: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

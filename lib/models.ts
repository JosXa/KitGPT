// noinspection JSArrowFunctionBracesCanBeRemoved

import type { LanguageModel } from "ai"
import { model } from "./cache"
import { typedObjectEntries } from "./typed-objects"

const PROVIDERS = {
  "openai.chat": {
    name: "OpenAI",
    getModel: async (modelId: string) => (await import("@ai-sdk/openai")).openai(modelId),
    // https://github.com/vercel/ai/blob/main/packages/openai/src/openai-chat-settings.ts
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
    authenticate: async () => {
      await env("OPENAI_API_KEY", {
        hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
      })
    },
  },
  "anthropic.messages": {
    name: "Anthropic",
    getModel: async (modelId: string) => (await import("@ai-sdk/anthropic")).anthropic(modelId),
    // https://github.com/vercel/ai/blob/main/packages/anthropic/src/anthropic-messages-settings.ts
    knownModels: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
    authenticate: async () => {
      await env("ANTHROPIC_API_KEY", {
        hint: `Grab a key from <a href="https://console.anthropic.com/settings/keys">here</a>`,
      })
    },
  },
  "google.generative-ai": {
    name: "Google",
    getModel: async (modelId: string) => (await import("@ai-sdk/google")).google(modelId),
    // https://github.com/vercel/ai/blob/main/packages/google/src/google-generative-ai-settings.ts
    knownModels: [
      "models/gemini-1.5-flash-latest",
      "models/gemini-1.5-pro-latest",
      "models/gemini-pro",
      "models/gemini-pro-vision",
    ],
    authenticate: async () => {
      await env("GOOGLE_API_KEY", {
        hint: `Grab a key from <a href="https://aistudio.google.com/app/apikey">here</a>`,
      })
    },
  },
  "google-vertex": {
    name: "Google Vertex",
    getModel: async (modelId: string) => (await import("@ai-sdk/google-vertex")).vertex(modelId),
    // https://github.com/vercel/ai/blob/main/packages/google-vertex/src/google-vertex-settings.ts
    knownModels: ["gemini-1.0-pro", "gemini-1.0-pro-vision"],
    authenticate: async () => {
      await env("GOOGLE_VERTEX_API_KEY", {
        hint: "Enter the Google Vertex API key",
      })
      await env("GOOGLE_VERTEX_PROJECT", {
        hint: "Please provide the Vertex project name",
      })
      await env("GOOGLE_VERTEX_LOCATION", {
        hint: "Please provide the Vertex location setting",
      })
    },
  },
  "mistral.chat": {
    name: "Mistral",
    getModel: async (modelId: string) => (await import("@ai-sdk/mistral")).mistral(modelId),
    // https://github.com/vercel/ai/blob/main/packages/mistral/src/mistral-chat-settings.ts
    knownModels: [
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b",
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
    ],
    authenticate: async () => {
      await env("MISTRAL_API_KEY", {
        hint: `Grab a key from <a href="https://console.mistral.ai/api-keys/">here</a>`,
      })
    },
  },
} as const satisfies {
  [key: string]: {
    name: string
    getModel: (modelId: string) => Promise<LanguageModel>
    knownModels: string[]
    authenticate: () => Promise<void>
  }
}

export type Provider = keyof typeof PROVIDERS

const getProviderOrThrow = (provider: Provider) => {
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

export async function switchModel() {
  const providerKey = await select(
    {
      hint: "Please select a provider",
      multiple: false,
      strict: true,
    },
    typedObjectEntries(PROVIDERS).map(([key, p]) => ({
      name: p.name,
      value: key,
    })),
  )

  const provider = PROVIDERS[providerKey]

  const modelId = await select<string>(
    {
      hint: `Please select the ${provider.name} chat completion model`,
      multiple: false,
      strict: false,
    },
    provider.knownModels,
  )

  await provider.authenticate()

  model.value = await provider.getModel(modelId)
}

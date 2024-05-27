// noinspection JSArrowFunctionBracesCanBeRemoved

import { error, refreshable, startSpinner } from "@josxa/kit-utils"
import { type LanguageModel, generateText, streamText } from "ai"
import type { EnvConfig } from "../../../../.kit/types/kit"
import { PROMPT_WIDTH } from "./settings"
import { currentModel } from "./store"
import { typedObjectEntries } from "./typed-objects"

const PROVIDERS = {
  "openai.chat": {
    name: "OpenAI",
    getModel: async (modelId: string) => (await import("@ai-sdk/openai")).openai(modelId),
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
    ensureAuthenticated: async (props) => {
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
    ensureAuthenticated: async (props) => {
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
    ensureAuthenticated: async (props) => {
      await env("GOOGLE_GENERATIVE_AI_API_KEY", {
        hint: `Grab a key from <a href="https://aistudio.google.com/app/apikey">here</a>`,
        ...props,
      })
    },
    platformStatisticsUrl: undefined,
  },
  "google-vertex": {
    name: "Google Vertex",
    getModel: async (modelId: string) => (await import("@ai-sdk/google-vertex")).vertex(modelId),
    // Keep in sync with https://github.com/vercel/ai/blob/main/packages/google-vertex/src/google-vertex-settings.ts
    knownModels: ["gemini-1.0-pro", "gemini-1.0-pro-vision"],
    ensureAuthenticated: async (props) => {
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
    ensureAuthenticated: async (props) => {
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

async function testProvider() {
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

export async function switchModel() {
  const canAbort = !!currentModel.value

  await refreshable<void>(async ({ refresh, resolve }) => {
    const providerKey = await select(
      {
        hint: "Please select a provider",
        multiple: false,
        width: PROMPT_WIDTH,
        strict: true,
        defaultValue: currentModel.value?.provider,
        shortcuts: canAbort
          ? [
              {
                name: "Back to Chat",
                key: "escape",
                visible: true,
                bar: "right",
                onPress() {
                  resolve()
                },
              },
              {
                name: "Back to Chat",
                key: `${cmd}+m`,
                visible: false,
                bar: "right",
                onPress() {
                  resolve()
                },
              },
            ]
          : undefined,
      },
      typedObjectEntries(PROVIDERS).map(([key, p]) => ({
        name: p.name,
        value: key,
      })),
    )

    const provider = PROVIDERS[providerKey]

    await provider.ensureAuthenticated({
      width: PROMPT_WIDTH,
      shortcuts: [
        {
          name: "Cancel",
          key: "escape",
          visible: true,
          bar: "right",
          onPress() {
            refresh()
          },
        },
      ],
    })

    const modelId = await select<string>(
      {
        hint: `Please select the ${provider.name} chat completion model`,
        width: PROMPT_WIDTH,
        multiple: false,
        strict: false,
        defaultValue: currentModel.value?.modelId,
        shortcuts: [
          {
            name: "Go Back to Provider Selection",
            key: "escape",
            visible: true,
            bar: "right",
            onPress() {
              refresh()
            },
          },
        ],
      },
      provider.knownModels,
    )

    currentModel.value = await provider.getModel(modelId)

    const spinner = startSpinner("spaceX", { initialMessage: "Testing connection..." }, { width: PROMPT_WIDTH })
    spinner.message = "Testing connection..." // TODO: There's a bug with the initialMessage
    const testResult = await testProvider()
    spinner.stop()

    if (!testResult.ok) {
      await div({
        html: md(`# Cannot connect to ${currentModel.value.provider}
      
**Error:** <u>${testResult.error}</u>

In case your access token is expired, please edit your \`~/.kenv/.env\` file.`),
        width: PROMPT_WIDTH,
      })
    }
  })
}

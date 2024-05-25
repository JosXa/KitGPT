import type { openai } from "@ai-sdk/openai"
import { effect, signal } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { type Provider, getModel } from "./models"

type DbData = {
  modelId?: Parameters<typeof openai>[0]
  provider?: Provider
  systemPrompt: string // TODO: Extend to support a collection
}
const settingsDb = await db("_kitgpt-chat.settings", {
  systemPrompt: "You are a helpful, respectful and honest assistant.",
} as DbData)

export const model = signal(
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined,
)
export const systemPrompt = signal(settingsDb.systemPrompt)

const debouncedWriteCache = debounce(settingsDb.write, 1000, {
  leading: false,
  trailing: true,
})

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.modelId = model.value?.modelId
  settingsDb.provider = model.value?.provider as Provider

  debouncedWriteCache()
})

type HistoryData = {
  conversations: {
    [key: number]: {
      title?: string
      started: Date
      lastAccessed: Date
      messages: CoreMessage[]
    }
  }
}

const historyLoaded = false
const historyDb = await db(
  "_kitgpt-chat.history",
  {
    conversations: {},
  } as HistoryData,
  false,
)

export async function getConversations() {
  if (!historyLoaded) {
    await historyDb.read()
  }
}

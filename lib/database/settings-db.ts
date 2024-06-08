import type { openai } from "@ai-sdk/openai"
import type { Provider } from "../ai/models"

type DbData = {
  modelId?: Parameters<typeof openai>[0]
  provider?: Provider
  chatMode: "chat" | "editor"
  systemPrompt: string // TODO: Extend to support a collection
  welcomeShown: boolean
}
export const settingsDb = await db("_kitgpt-chat.settings", {
  systemPrompt: "You are a helpful, respectful and honest assistant.",
  welcomeShown: false,
  chatMode: "chat",
} as DbData)

export const debouncedWriteSettings = debounce(settingsDb.write, 1000, {
  leading: false,
  trailing: true,
})

export function initialize() {}

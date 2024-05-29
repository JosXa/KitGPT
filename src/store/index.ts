import type { openai } from "@ai-sdk/openai"
import { batch, effect, signal } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { deepSignal } from "deepsignal/core"
import { type Provider, getModel } from "../ai/models"
import type { FollowupQuestions } from "../ai/suggestions"
import { debouncedUpdateConversation, insertConversation } from "../database/conversations"

export const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)

type DbData = {
  modelId?: Parameters<typeof openai>[0]
  provider?: Provider
  systemPrompt: string // TODO: Extend to support a collection
  welcomeShown: boolean
}
const settingsDb = await db("_kitgpt-chat.settings", {
  systemPrompt: "You are a helpful, respectful and honest assistant.",
  welcomeShown: false,
} as DbData)

export const currentModel = signal(
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined,
)
export const systemPrompt = signal(settingsDb.systemPrompt)
export const welcomeShown = signal(settingsDb.welcomeShown)

const debouncedWriteCache = debounce(settingsDb.write, 1000, {
  leading: false,
  trailing: true,
})

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.welcomeShown = welcomeShown.value
  settingsDb.modelId = currentModel.value?.modelId
  settingsDb.provider = currentModel.value?.provider as Provider

  debouncedWriteCache()
})

export const messages = deepSignal<CoreMessage[]>([])

export const subscribeToMessageEdits = (
  handler: ((msgSignal: (typeof messages)[number], idx: number) => unknown) | (() => void),
) =>
  effect(() => {
    const cleanupFns = messages.map((msgSignal, idx) => {
      let firstRun = true
      return msgSignal.$content!.subscribe(() => {
        if (firstRun) {
          firstRun = false
          return
        }
        handler(msgSignal, idx)
      })
    })

    return () => cleanupFns.forEach((sub) => sub())
  })

export const currentConversationId = signal<number | undefined>(undefined)
export const currentConversationTitle = signal<string | undefined>(undefined)

const isInserting = signal(false)
effect(() => {
  messages.forEach((x) => x.content) // dep

  if (currentConversationId.value) {
    debouncedUpdateConversation(currentConversationId.value, {
      title: currentConversationTitle.value ?? "Untitled",
      messages,
    })
  } else {
    if (messages.length === 0 || isInserting.value) {
      return
    }

    isInserting.value = true

    insertConversation({
      title: currentConversationTitle.value,
      messages: messages,
    })
      .then((res) => {
        const metadataOfInserted = res[0]!
        currentConversationId.value = metadataOfInserted.id
      })
      .finally(() => {
        isInserting.value = false
      })
  }
})

export function resetConversation() {
  batch(() => {
    currentConversationId.value = undefined
    currentConversationTitle.value = undefined
    currentSuggestions.value = undefined
    messages.splice(0, messages.length)
  })
}

export type KitGptScreen = "ConfigureSystemPrompt" | "ConversationHistory" | "SwitchModel" | "Welcome"

export const currentScreen = signal<string | undefined>(undefined)

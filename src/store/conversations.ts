import { batch, effect, signal } from "@preact/signals-core"
import { debouncedUpdateConversation, insertConversation } from "../database/conversations"
import { currentSuggestions, messages } from "./chat"

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

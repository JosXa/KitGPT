import { batch, computed, signal } from "@preact/signals-core"
import { currentSuggestions } from "../../store/chat"
import { currentUnsentDraft } from "../../store/conversations"
import { messages } from "../../store/messages"

const selectedSuggestion = signal<{ text: string } | undefined>(undefined)

export const actions = computed(() => {
  if (selectedSuggestion.value) {
    return [
      {
        name: "📤 Send",
        onAction() {
          batch(() => {
            messages.push({ role: "user", content: selectedSuggestion.value!.text })
            selectedSuggestion.value = undefined
            closeActionsPanel()
          })
        },
        visible: true,
      },
      {
        name: "📝 Use as template",
        onAction() {
          batch(() => {
            currentUnsentDraft.value = selectedSuggestion.value!.text
            selectedSuggestion.value = undefined
            closeActionsPanel()
          })
        },
        visible: true,
      },
      {
        name: "❌ Cancel",
        onAction() {
          batch(() => {
            selectedSuggestion.value = undefined
          })
        },
        visible: true,
      },
    ]
  }

  const suggestions = currentSuggestions.value
  if (!suggestions) {
    return []
  }

  return (
    [
      { text: `${suggestions.moreExamplesQuestion}`, emoji: "➕" },
      ...suggestions.followupQuestions.map((x) => ({
        group: "Suggestions",
        text: x.question,
        emoji: x.emoji,
      })),
    ] as const
  ).flatMap((x) => [
    {
      name: `${x.emoji} ${x.text}`,
      onAction: () => {
        selectedSuggestion.value = { text: x.text }
      },
      visible: true,
    },
  ])
})

export function closeActionsPanel() {
  setFlagValue(undefined)
}

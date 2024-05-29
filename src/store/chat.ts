import { effect, signal } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { deepSignal } from "deepsignal/core"
import type { FollowupQuestions } from "../ai/suggestions"

export const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)

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

import { effect } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { deepSignal } from "deepsignal/core"
import type { ChatControls } from "../ai/tool-calling"

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

export const chatControls: ChatControls = {
  send: (text) => messages.push({ role: "assistant", content: text }),
  append: (text) => {
    const lastMessageInChat = messages[messages.length - 1]
    if (lastMessageInChat && lastMessageInChat.role === "assistant") {
      lastMessageInChat.content += text
    } else {
      messages.push({ role: "assistant", content: text })
    }
  },
  appendLine: (text) => {
    const lastMessageInChat = messages[messages.length - 1]
    if (lastMessageInChat && lastMessageInChat.role === "assistant") {
      lastMessageInChat.content += "\n\n" + text
    } else {
      messages.push({ role: "assistant", content: text })
    }
  },
}

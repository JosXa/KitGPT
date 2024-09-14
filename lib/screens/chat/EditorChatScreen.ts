import type { Shortcut } from "@johnlindquist/kit/types"
import type { RefreshableControls } from "@josxa/kit-utils"
import { type Signal, batch, computed, effect, signal, untracked } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { currentUnsentDraft } from "../../store/conversations"
import { messages } from "../../store/messages"
import AbstractChatScreen from "./AbstractChatScreen"

const AI_RESPONDING_INDICATOR = "\n\n🤖 "

function formatConversationAsText() {
  const parts: string[] = []

  for (const message of messages) {
    if (message.role === "assistant") {
      parts.push(`🤖 ${message.content}`.trim())
    } else if (message.role === "user") {
      parts.push(`👤 ${message.content}`.trim())
    }
  }

  return parts.join("\n\n")
}

function parseAndUpdateMessages(editorContent: string) {
  const lines = editorContent.split("\n")

  let speaker: "user" | "assistant" | undefined = undefined

  const newMessages: CoreMessage[] = []

  let message = ""
  for (const line of lines) {
    if (line.startsWith("👤")) {
      if (message.trim() !== "" && speaker) {
        newMessages.push({ role: speaker, content: message.trim() })
      }
      speaker = "user"
      message = line.replace(/^👤\s?/gm, "")
    } else if (line.startsWith("🤖")) {
      if (message.trim() !== "" && speaker) {
        newMessages.push({ role: speaker, content: message.trim() })
      }
      speaker = "assistant"
      message = line.replace(/^🤖\s?/gm, "")
    } else if (speaker) {
      // We know who speaks, just keep appending
      message += "\n" + line
    } else {
      // Support a leading text without emoji and interpret it as user request
      speaker = "user"
      message = line
    }
  }

  if (message.trim() !== "" && speaker) {
    newMessages.push({ role: speaker, content: message.trim() })
  }

  batch(() => messages.splice(0, messages.length, ...newMessages))
}

/** The conversation thus far, excluding the current user input */
const precedingConversationContent = signal<string>("")

function extractUserInput(editorContent: string): string | null {
  const linesReversed = editorContent.split("\n").toReversed()

  let result: string | undefined = undefined
  const prepend = (val: string) => (result === undefined ? val : `${val}\n${result}`)

  for (const line of linesReversed) {
    if (line.startsWith("👤")) {
      return prepend(line.replace(/^👤\s?/gm, ""))
    }
    if (line.startsWith("🤖")) {
      // If we find an assistant emoji before a user emoji, there cannot be any user input
      return null
    }
    result = prepend(line)
  }

  // When no emoji is present, treat the full content as user input
  return result ?? ""
}

function fastSplitConversationFromUserDraft(editorContent: string) {
  const userInput = extractUserInput(editorContent)

  let conversationContent: string
  if (userInput) {
    const idx = editorContent.lastIndexOf(userInput)
    conversationContent = editorContent.slice(0, idx)
  } else {
    conversationContent = editorContent
  }

  return { conversationContent, userDraft: userInput ?? "" }
}

export default class EditorChatScreen extends AbstractChatScreen<void> {
  protected name = "editor"

  private waitingForResponseToBegin = signal(false)
  private currentInput: Signal<string> = computed(() => precedingConversationContent.value + currentUnsentDraft.value)

  private inputControlled = signal(false)

  private commit() {
    this.inputControlled.value = true
    this.waitingForResponseToBegin.value = true
    parseAndUpdateMessages(this.currentInput.value.trim())
  }

  override *initEffects() {
    yield effect(() => {
      if (this.inputControlled.value) {
        if (this.waitingForResponseToBegin.value) {
          precedingConversationContent.value = formatConversationAsText() + AI_RESPONDING_INDICATOR
          setInput(precedingConversationContent.value)
        } else {
          precedingConversationContent.value = formatConversationAsText()
          setInput(precedingConversationContent.value)
        }
      } else {
        const text = formatConversationAsText()
        precedingConversationContent.value = text + (text.trim() === "" ? "" : "\n\n👤 ")
        setInput(untracked(() => precedingConversationContent.value))
      }
    })

    yield effect(() => {
      const lastMsg = messages[messages.length - 1]
      if (!lastMsg) {
        return
      }

      if (lastMsg.role === "assistant") {
        this.waitingForResponseToBegin.value = false

        if (!this.isResponseInProgress.value) {
          this.inputControlled.value = false
          precedingConversationContent.value = formatConversationAsText()
        }
      }
    })

    yield currentUnsentDraft.subscribe((val) => val.endsWith("\n\n") && this.commit())
  }

  override getExtraShortcuts(): Shortcut[] {
    return [
      {
        name: "Send",
        key: `${cmd}+S`,
        onPress: () => this.commit(),
        visible: true,
        bar: "left",
      },
    ]
  }

  async render(refreshableControls: RefreshableControls<void>) {
    const self = this
    const config = this.buildPromptConfig(refreshableControls)

    let firstTimeInput = true

    //@ts-expect-error Kit typings bug
    await editor({
      ...config,
      suggestions: [],
      codeLens: false,
      scrollTo: "bottom",
      input: formatConversationAsText() + currentUnsentDraft.value,
      onInput(content) {
        if (firstTimeInput) {
          // Necessary due to bug: https://discord.com/channels/804053880266686464/1149451928556814366/1248794856973799508
          firstTimeInput = false
          return
        }

        if (self.inputControlled.value) {
          // Ignore changes
          return
        }

        const sanitized = content?.replaceAll("\r\n", "\n") ?? ""

        const { conversationContent, userDraft } = fastSplitConversationFromUserDraft(sanitized)

        batch(() => {
          precedingConversationContent.value = conversationContent
          currentUnsentDraft.value = userDraft
        })
      },
    })
  }
}

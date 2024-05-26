// Name: KitGPT
// Description: Chat with a variety of transformer models
// Trigger: chat
// Shortcut: cmd shift ä

import "@johnlindquist/kit"

import type { Action } from "@johnlindquist/kit"
import { error, refreshable } from "@josxa/kit-utils"
import { computed, effect, signal } from "@preact/signals-core"
import { type CoreMessage, streamText } from "ai"
import type { Shortcut } from "../../../../.kit"
import configureSystemPrompt from "../lib/configureSystemPrompt"
import { showConversationHistory } from "../lib/history"
import { switchModel } from "../lib/models"
import { PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../lib/settings"
import { currentSuggestions, messages, model, subscribeToMessageEdits, systemPrompt } from "../lib/store"
import { getSuggestions } from "../lib/suggestions"

const refreshHandle = signal<(() => any) | undefined>(undefined)
const runningResponseStream = signal<AbortController | null>(null)

async function newConversation() {
  runningResponseStream.value?.abort("Resetting")
  runningResponseStream.value = null

  messages.splice(0, messages.length)
  await chat.setMessages?.([])
}

async function streamResponse() {
  runningResponseStream.value?.abort(new Error("New message arrived"))
  runningResponseStream.value = new AbortController()

  try {
    const result = await streamText({
      model: model.value!,
      system: systemPrompt.value,
      messages: messages,
      abortSignal: runningResponseStream.value.signal,
    })

    // Insert new message into the deep signal and get out a reactive version
    const generatingMessage =
      messages[
        messages.push({
          role: "assistant",
          content: "",
        }) - 1
      ]!

    for await (const delta of result.textStream) {
      generatingMessage.content += delta
    }

    runningResponseStream.value = null
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "New message arrived") {
      return // Ok
    }
    await error(err, "Unexpected error during response stream")
    refreshHandle.value?.()
  }
}

function buildKitMessage(coreMessage: CoreMessage) {
  return {
    title: coreMessage.role,
    text: md(Array.isArray(coreMessage.content) ? coreMessage.content.join("") : coreMessage.content),
  }
}

const prevLength = signal(0)

effect(function onNewMessages() {
  const newLength = messages.length

  if (newLength === 0) {
    prevLength.value = 0
    return
  }

  if (newLength > prevLength.value) {
    const newMessages = messages.slice(prevLength.value, newLength)
    newMessages.forEach((msg) => {
      if (msg.role === "user") {
        streamResponse().then(() => getSuggestions())
      } else {
        // Add generated message to Kit
        chat.addMessage?.(buildKitMessage(msg))
      }
    })
  }

  prevLength.value = newLength
})

subscribeToMessageEdits((msgSignal, idx) => chat.setMessage?.(idx, buildKitMessage(msgSignal)))

const showClear = computed(() => messages.length > 0)

const shortcuts = computed(() => {
  const res: Shortcut[] = [
    {
      name: "Close",
      key: `${cmd}+w`,
      onPress: () => process.exit(),
      bar: "left",
    },
  ]

  if (showClear.value) {
    res.push({
      name: "Clear",
      key: `${cmd}+shift+backspace`,

      onPress: async () => {
        await newConversation()
        refreshHandle.value?.()
      },
      bar: "left",
    })
  }

  res.push({
    name: "History",
    key: `${cmd}+h`,
    onPress: async () => {
      await showConversationHistory()
      refreshHandle.value?.()
    },
    bar: "left",
  })

  res.push(
    {
      name: "System Prompt",
      key: `${cmd}+p`,
      onPress: async () => {
        await configureSystemPrompt()
        refreshHandle.value?.()
      },
      bar: "right",
      visible: true,
    },
    {
      name: "Model",
      key: `${cmd}+m`,
      onPress: async () => {
        await switchModel()
        refreshHandle.value?.()
      },
      bar: "right",
      visible: true,
    },
  )

  return res
})

const actions = computed(() => {
  const result: Action[] = []

  const sugg = currentSuggestions.value
  if (!sugg) {
    return result
  }

  const zeroWidthSpace = " " // Make items appear at the top
  result.push({
    name: `${zeroWidthSpace}➕ ${sugg.moreExamplesQuestion}`,
    onAction: () => {
      chat.addMessage?.({ title: "user", text: md(sugg.moreExamplesQuestion), position: "right" })
      messages.push({ role: "user", content: sugg.moreExamplesQuestion })
    },
    visible: true,
  })

  result.push(
    ...sugg.followupQuestions.map((x) => ({
      name: `${x.emoji} ${x.question}`,
      onAction: () => {
        chat.addMessage?.({ title: "user", text: md(x.question), position: "right" })
        messages.push({ role: "user", content: x.question })
      },
      visible: true,
    })),
  )

  return result
})

await refreshable(async ({ refresh }) => {
  refreshHandle.value = refresh

  effect(() => setShortcuts(shortcuts.value))
  effect(() => setActions(actions.value))

  // noinspection JSArrowFunctionBracesCanBeRemoved
  return await chat({
    width: PROMPT_WIDTH,
    async onInit() {
      if (!model.value) {
        await switchModel()
        refresh()
        return
      }
      setDescription(`${model.value.provider} - ${model.value.modelId}`)
    },
    shortcuts: shortcuts.value,
    actions: actions.value,
    previewWidthPercent: PREVIEW_WIDTH_PERCENT,
    strict: true, // No empty messages
    alwaysOnTop: false,
    keepPreview: false,
    onBlur() {
      console.log("blur")
    },
    css: `
div.kit-mbox > ul, ol {
  margin-block-start: 0 !important;
}

.rce-mbox:not(.rce-mbox-right) {
  border: 0;
}
    `,
    onEscape: () => runningResponseStream.value?.abort("User canceled"),
    onSubmit: (content) => {
      content && messages.push({ role: "user", content })
    },
  })
})

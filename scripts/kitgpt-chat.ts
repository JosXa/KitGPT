// Name: KitGPT
// Description: Chat with a variety of LLMs
// Trigger: chat
// Shortcut: cmd shift ä

import "@johnlindquist/kit"

import type { Action, Shortcut } from "@johnlindquist/kit"

import { error, refreshable } from "@josxa/kit-utils"
import { batch, computed, effect, signal } from "@preact/signals-core"

import { type CoreMessage, streamText } from "ai"
import { deepSignal } from "deepsignal/core"
import { generateNewTitleForConversation } from "../lib/ai/conversation-title"
import { getSuggestions } from "../lib/ai/suggestions"
import configureSystemPrompt from "../lib/configureSystemPrompt"
import { showConversationHistory } from "../lib/conversation-history"
import { type Provider, getProviderOrThrow, switchModel } from "../lib/models"
import { PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../lib/settings"
import {
  currentConversationId,
  currentConversationTitle,
  currentSuggestions,
  messages,
  model,
  subscribeToMessageEdits,
  systemPrompt,
} from "../lib/store"
import { titleCase } from "../lib/utils"

const refreshHandle = signal<(() => any) | undefined>(undefined)
const runningResponseStream = signal<AbortController | null>(null)
const cancelResponseStream = () => {
  runningResponseStream.value?.abort(new Error("Aborted"))
  return null
}

function newConversation() {
  runningResponseStream.value = cancelResponseStream()

  batch(() => {
    currentConversationId.value = undefined
    currentConversationTitle.value = undefined

    messages.splice(0, messages.length)
  })
}

async function streamResponse() {
  cancelResponseStream()
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
    if (err instanceof Error && err.message === "Aborted") {
      return // Ok
    }
    await error(err, "Unexpected error during response stream")
    refreshHandle.value?.()
  }
}

function buildKitMessage(coreMessage: CoreMessage) {
  const mdText = Array.isArray(coreMessage.content) ? coreMessage.content.join("") : coreMessage.content

  return {
    title: coreMessage.role === "user" ? "You" : titleCase(coreMessage.role),
    text: md(mdText),
    position: coreMessage.role === "user" ? "right" : "left",
  }
}

const prevLength = signal(0)

const kitUpdateQueue = deepSignal<Array<() => Promise<unknown> | unknown>>([])
effect(() => {
  if (kitUpdateQueue.length > 0) {
    fireUpdates()
  }
})

let isRunning = false
const fireUpdates = async () => {
  if (isRunning) {
    return
  }
  isRunning = true

  try {
    while (kitUpdateQueue.length > 0) {
      await kitUpdateQueue.shift()?.()
    }
  } finally {
    isRunning = false
  }
}

messages.$length!.subscribe(function onNewMessages(newLength: number) {
  if (newLength === 0) {
    kitUpdateQueue.push(() => chat.setMessages?.([]))
  } else if (newLength > prevLength.value) {
    const newMessages = messages.slice(prevLength.value, newLength)

    newMessages.forEach((msg, idx) => {
      const msgIdx = prevLength.value + idx
      const kitMsg = buildKitMessage(msg)
      kitUpdateQueue.push(() => chat.setMessage?.(msgIdx, kitMsg))
    })
  }

  prevLength.value = newLength
})

subscribeToMessageEdits((msgSignal, idx) => chat.setMessage?.(idx, buildKitMessage(msgSignal)))

const shortcuts = computed(() => {
  const res: Shortcut[] = [
    {
      name: "Close",
      key: `${cmd}+w`,
      onPress: () => process.exit(),
      bar: "left",
    },
  ]

  if (messages.length > 0) {
    res.push({
      name: "New Conversation",
      key: `${cmd}+n`,

      onPress: () => {
        newConversation()
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

  const platformStatisticsUrl = model.value
    ? getProviderOrThrow(model.value.provider as Provider).platformStatisticsUrl
    : undefined

  if (platformStatisticsUrl) {
    res.push({
      name: "Usage",
      key: `${cmd}+u`,
      onPress: () => {
        // noinspection JSArrowFunctionBracesCanBeRemoved
        open(platformStatisticsUrl)
      },
      bar: "left",
    })
  }

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

effect(() => {
  if (currentConversationTitle.value) {
    return
  }

  if (messages.map((x) => x.content).join("\n").length > 50) {
    currentConversationTitle.value = "Generating title..."
    generateNewTitleForConversation()
  }
})

await refreshable(async ({ refresh: _refresh }) => {
  const cleanupFns: (() => void)[] = []

  const refresh = () => {
    cleanupFns.forEach((fn) => fn())
    _refresh()
  }

  refreshHandle.value = refresh

  // noinspection JSArrowFunctionBracesCanBeRemoved
  return await chat({
    width: PROMPT_WIDTH,
    async onInit() {
      cleanupFns.push(effect(() => setShortcuts(shortcuts.value)))
      cleanupFns.push(effect(() => setActions(actions.value)))
      cleanupFns.push(effect(() => setName(currentConversationTitle.value ?? "KitGPT")))

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
    css: `
div.kit-mbox > ul, ol {
  margin-block-start: 0 !important;
}

.rce-mbox:not(.rce-mbox-right) {
  border: 0;
}
    `,
    onEscape: () => {
      cancelResponseStream()
    },
    onSubmit: (content) => {
      content && messages.push({ role: "user", content })
      streamResponse().then(() => getSuggestions())
    },
  })
})

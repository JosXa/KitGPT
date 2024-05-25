// Name: KitGPT
// Description: Chat with a variety of transformer models
// Trigger: chat
// Shortcut: cmd shift ä

import "@johnlindquist/kit"

import { error, refreshable } from "@josxa/kit-utils"
import type { FORCE_REFRESH } from "@josxa/kit-utils/dist/src/refreshable"
import { signal, untracked } from "@preact/signals-core"
import { type CoreMessage, streamText } from "ai"
import type { Shortcut } from "../../../../.kit"
import configureSystemPrompt from "../lib/configureSystemPrompt"
import { switchModel } from "../lib/models"
import { PROMPT_WIDTH } from "../lib/settings"
import { model, systemPrompt } from "../lib/store"

let errorHandler: (err: unknown, title?: string) => Promise<void> = (err: unknown) => {
  throw err
}

const messages: CoreMessage[] = []
const messagesDirty = signal(false)
const userMessage = signal<string>("")
const runningResponseStream = signal<AbortController | null>(null)

const lastKitMessageIdx = signal(-1)

async function reset() {
  messages.splice(0, messages.length)
  lastKitMessageIdx.value = -1

  runningResponseStream.value?.abort("Resetting")
  runningResponseStream.value = null
  await chat?.setMessages?.([])
}

userMessage.subscribe(async function onUserMessage(content) {
  if (userMessage.value === "") {
    return
  }
  untracked(() => {
    userMessage.value = ""
  })
  messages.push({ role: "user", content })
  lastKitMessageIdx.value += 1

  if (runningResponseStream.value) {
    runningResponseStream.value.abort()
  }
  await streamResponse()
})

async function streamResponse() {
  runningResponseStream.value = new AbortController()

  const assistantResponse: CoreMessage = { role: "assistant", content: "" }

  try {
    const result = await streamText({
      model: model.value!,
      system: systemPrompt.value,
      messages: messages,
      abortSignal: runningResponseStream.value.signal,
    })

    messages.push(assistantResponse)

    for await (const delta of result.textStream) {
      assistantResponse.content += delta
      messagesDirty.value = true
    }

    runningResponseStream.value = null
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return // Ok
    }
    await errorHandler(err, "Unexpected error during response stream")
  }
}

messagesDirty.subscribe((val) => {
  if (!val) {
    return
  }

  const lastMsgIdx = messages.length - 1
  const lastMsg = messages[lastMsgIdx]
  if (!lastMsg) {
    return
  }

  try {
    if (lastMsg.role === "user") {
      return // Already added by Kit
    }

    let content: string
    if (Array.isArray(lastMsg.content)) {
      content = lastMsg.content.join("") // TODO
    } else {
      content = lastMsg.content
    }

    content = md(content)

    if (lastMsgIdx > lastKitMessageIdx.value) {
      chat.addMessage?.({ title: lastMsg.role, text: content })
      lastKitMessageIdx.value += 1
    } else {
      chat.setMessage?.(lastMsgIdx, { title: lastMsg.role, text: content })
    }
  } finally {
    messagesDirty.value = false
  }
})

function buildShortcuts({
  refresh,
  showClear,
}: {
  refresh: () => typeof FORCE_REFRESH
  showClear: boolean
}): Shortcut[] {
  return [
    {
      name: "Close",
      key: `${cmd}+w`,
      onPress: () => process.exit(),
      bar: "left",
    },
    {
      name: "Clear",
      key: `${cmd}+shift+backspace`,
      onPress: async () => {
        await reset()
        refresh()
      },
      bar: "left",
    },
    {
      name: "System Prompt",
      key: `${cmd}+p`,
      onPress: async () => {
        await configureSystemPrompt()
        refresh()
      },
      bar: "right",
      visible: true,
    },
    {
      name: "Model",
      key: `${cmd}+m`,
      onPress: async () => {
        await switchModel()
        refresh()
      },
      bar: "right",
      visible: true,
    },
  ]
}

// TODO: Think about whether holding the kit messages in a signal would be better
await refreshable(
  async ({ refresh }) =>
    await chat({
      width: PROMPT_WIDTH,
      async onInit() {
        setTimeout(() => {
          setBounds({ height: 2000 })
        }, 1000)
        errorHandler = async (err, title) => {
          await error(err, title)
          refresh()
        }

        if (!model.value) {
          await switchModel()
          refresh()
          return
        }
        setDescription(`${model.value.provider} - ${model.value.modelId}`)
      },
      shortcuts: buildShortcuts(refresh),
      actions: [
        // {
        //   name: "System Prompt",
        //   shortcut: `${cmd}+p`,
        //   onAction: async () => {
        //     await configureSystemPrompt()
        //     refresh()
        //   },
        //   visible: false,
        // },
      ],
      inputRegex: "\\S",
      strict: true,
      alwaysOnTop: false,
      css: `
div.kit-mbox > ul, ol {
  margin-block-start: 0 !important;
}

.rce-mbox:not(.rce-mbox-right) {
  border: 0;
}
    `,
      onEscape: () => runningResponseStream.value?.abort("User canceled"),
      onInputSubmit: {
        tl: "/tl",
      },
      onSubmit: async (input) => {
        if (!input) {
          const msgs = await chat?.getMessages?.()
          console.log(msgs)
          return
        }
        userMessage.value = input
      },
    }),
)

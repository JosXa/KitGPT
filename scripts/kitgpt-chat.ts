// Name: KitGPT
// Description: Chat with a variety of transformer models
// Trigger: chat

import "@johnlindquist/kit"
import { error, refreshable } from "@josxa/kit-utils"
import { signal, untracked } from "@preact/signals-core"
import { type CoreMessage, streamText } from "ai"
import { model, systemPrompt } from "../lib/cache"
import configureSystemPrompt from "../lib/configureSystemPrompt"
import { PROMPT_WIDTH } from "../lib/settings"

await env("OPENAI_API_KEY", {
  hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
})

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

  const msg: CoreMessage = { role: "assistant", content: "" }
  messages.push(msg)

  const result = await streamText({
    model: model.value,
    system: systemPrompt.value,
    messages: messages,
    abortSignal: runningResponseStream.value.signal,
  })

  let currentResponse = ""

  try {
    for await (const delta of result.textStream) {
      currentResponse += delta
      msg.content += delta
      messagesDirty.value = true
    }

    runningResponseStream.value = null
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return // Ok
    }
    await error(err, "Unexpected error during response stream")
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

// TODO: Think about whether holding the kit messages in a signal would be better
await refreshable(async ({ refresh }) => {
  await chat({
    width: PROMPT_WIDTH,
    onInit() {
      setDescription(`${model.value.modelId}`)
    },
    shortcuts: [
      {
        name: "Close",
        key: `${cmd}+w`,
        onPress: () => process.exit(),
        bar: "left",
      },
      {
        name: "Continue Script",

        key: `${cmd}+enter`,
        onPress: () => submit(""),
        bar: "right",
      },
      {
        name: "Clear",
        key: `${cmd}+alt+backspace`,
        onPress: async () => {
          await reset()
          refresh()
        },
        bar: "right",
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
    ],
    css: `
div.kit-mbox > ul, ol {
  margin-block-start: 0 !important;
}
.rce-mbox:not(.rce-mbox-right) {
  border: 0;
}
    `,
    onEscape: () => runningResponseStream.value?.abort("User canceled"),
    onSubmit: (input) => {
      if (!input) {
        return
      }
      userMessage.value = input
    },
  })
})

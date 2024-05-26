// Name: KitGPT
// Description: Chat with a variety of transformer models
// Trigger: chat
// Shortcut: cmd shift ä

import "@johnlindquist/kit"

import type { Action } from "@johnlindquist/kit"
import { error, refreshable } from "@josxa/kit-utils"
import { computed, effect, signal } from "@preact/signals-core"
import { type CoreMessage, generateObject, streamText } from "ai"
import { deepSignal } from "deepsignal/core"
import { z } from "zod"
import type { Shortcut } from "../../../../.kit"
import configureSystemPrompt from "../lib/configureSystemPrompt"
import { switchModel } from "../lib/models"
import { PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../lib/settings"
import { model, systemPrompt } from "../lib/store"

const refreshHandle = signal<(() => any) | undefined>(undefined)
const messages = deepSignal<CoreMessage[]>([])
const runningResponseStream = signal<AbortController | null>(null)

async function reset() {
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

const followupQuestionsSchema = z.object({
  moreExamplesQuestion: z.string(),
  followupQuestions: z.array(
    z.object({
      question: z.string(),
      emoji: z.string(),
    }),
  ),
})

type FollowupQuestions = z.infer<typeof followupQuestionsSchema>
const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)

messages.$length!.subscribe(() => (currentSuggestions.value = undefined))

async function getSuggestions({
  includeSystemPromptInContext = false,
  contextLookbackMessages = 4,
}: { includeSystemPromptInContext?: boolean; contextLookbackMessages?: number } = {}) {
  const context = messages.slice(-contextLookbackMessages)
  context.push({
    role: "user",
    content:
      "Please list 4 possible follow-up questions I could ask about this. Also give me a good question to ask if I'm looking for more examples",
  })

  const { object } = await generateObject({
    model: model.value!,
    schema: followupQuestionsSchema,
    messages: context,
    system: includeSystemPromptInContext ? systemPrompt.value : undefined,
  })

  currentSuggestions.value = object
}

const itemUpdateSubscriptions = signal<(() => void)[]>([])

function buildKitMessage(coreMessage: CoreMessage) {
  return {
    title: coreMessage.role,
    text: md(Array.isArray(coreMessage.content) ? coreMessage.content.join("") : coreMessage.content),
  }
}

const prevLength = signal(0)

messages.$length?.subscribe((newLength) => {
  itemUpdateSubscriptions.value.forEach((cleanup) => cleanup())

  if (newLength === 0) {
    return
  }

  if (newLength <= prevLength.value) {
    throw Error("Unknown state: Array got smaller or stayed the same size")
  }

  const newMessages = messages.slice(prevLength.value, newLength)
  newMessages.forEach((msg) => {
    if (msg.role === "user") {
      streamResponse().then(() => getSuggestions())
    } else {
      // Add generated message to Kit
      chat.addMessage?.(buildKitMessage(msg))
    }
  })

  prevLength.value = newLength

  itemUpdateSubscriptions.value = messages.map((msgSignal, idx) => {
    let firstRun = true
    return msgSignal.$content!.subscribe(() => {
      if (firstRun) {
        firstRun = false
        return
      }
      chat.setMessage?.(idx, buildKitMessage(msgSignal))
      return
    })
  })

  return () => itemUpdateSubscriptions.value.forEach((sub) => sub())
})

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
        await reset()
        refreshHandle.value?.()
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

await refreshable(async ({ refresh }) => {
  refreshHandle.value = refresh

  if (!model.value) {
    await switchModel()
    refresh()
    return
  }

  effect(() => setShortcuts(shortcuts.value))
  effect(() => setActions(actions.value))

  return await chat({
    width: PROMPT_WIDTH,
    onInit() {
      setDescription(`${model.value.provider} - ${model.value.modelId}`)
    },
    shortcuts: shortcuts.value,
    actions: actions.value,
    previewWidthPercent: PREVIEW_WIDTH_PERCENT,
    inputRegex: "\\S",
    strict: true,
    alwaysOnTop: false,
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
    onInputSubmit: {
      tl: "/tl",
    },
    onSubmit: async (content) => {
      if (!content) {
        const msgs = await chat.getMessages?.()
        console.log(msgs)
        return
      }

      messages.push({ role: "user", content })
    },
  })
})

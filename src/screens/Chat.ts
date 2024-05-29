import "@johnlindquist/kit"

import type { Action, Shortcut } from "@johnlindquist/kit"
import { type RefreshableControls, showError } from "@josxa/kit-utils"
import { batch, computed, effect, signal, untracked } from "@preact/signals-core"

import { type CoreMessage, streamText } from "ai"
import { deepSignal } from "deepsignal/core"
import { generateNewTitleForConversation } from "../ai/conversation-title"
import { type Provider, getProviderOrThrow } from "../ai/models"
import { getSuggestions } from "../ai/suggestions"
import { CHAT_WINDOW_HEIGHT, PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../settings"
import { currentScreen } from "../store"
import { currentSuggestions, messages, subscribeToMessageEdits } from "../store/chat"
import { currentConversationTitle, resetConversation } from "../store/conversations"
import { currentModel, systemPrompt } from "../store/settings"
import { titleCase } from "../utils/string-utils"
import ConfigureSystemPrompt from "./ConfigureSystemPrompt"
import ConversationHistory from "./ConversationHistory"
import SwitchModel from "./SwitchModel"
import { KitGptScreen } from "./base/KitGptScreen"

enum Status {
  Ready = "Ready",
  GettingSuggestions = "Getting suggestions...",
  Responding = "Responding...",
}

const refreshHandle = signal<(() => any) | undefined>(undefined)
const currentStatus = signal(Status.Ready)

const currentResponseStream = signal<AbortController | null>(null)
const abortResponseStream = () => {
  currentResponseStream.value?.abort(new Error("Aborted"))
  currentResponseStream.value = null
}

effect(function abortWhenConversationResets() {
  if (messages.length === 0) {
    abortResponseStream()
  }
})

async function streamResponse() {
  abortResponseStream()
  currentResponseStream.value = new AbortController()

  try {
    const result = await streamText({
      model: currentModel.value!,
      system: systemPrompt.value,
      messages: messages,

      abortSignal: currentResponseStream.value.signal,
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

    currentResponseStream.value = null
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Aborted") {
      return // Ok
    }
    await showError(err, `An error occurred while generating a response from ${currentModel.value?.provider}`)
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

const kitUpdateQueue = deepSignal<Array<() => Promise<unknown> | unknown>>([])
effect(() => kitUpdateQueue.length > 0 && fireUpdates())

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

const prevLength = signal(0)
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

effect(function streamResponseOnUserMessage() {
  if (messages.length > 0 && messages[messages.length - 1]?.role === "user" && currentResponseStream.value === null) {
    untracked(() => {
      currentStatus.value = Status.Responding
      return streamResponse()
    })
  }
})

effect(function getSuggestionsOnAssistantMessage() {
  if (
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    currentResponseStream.value === null
  ) {
    untracked(() => {
      currentStatus.value = Status.GettingSuggestions
      getSuggestions().finally(() => {
        if (currentStatus.value === Status.GettingSuggestions) {
          currentStatus.value = Status.Ready
        }
      })
    })
  }
})

subscribeToMessageEdits((msgSignal, idx) => chat.setMessage?.(idx, buildKitMessage(msgSignal)))

const showOptions = signal(false)

const shortcuts = computed(() => {
  //#region Left bar
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
        resetConversation()
        refreshHandle.value?.()
      },
      bar: "left",
    })
  }

  res.push({
    name: "History",
    key: `${cmd}+h`,
    onPress: async () => {
      await new ConversationHistory().run()
      refreshHandle.value?.()
    },
    bar: "left",
  })

  //#endregion

  //#region Right bar (options)

  const platformStatisticsUrl = currentModel.value
    ? getProviderOrThrow(currentModel.value.provider as Provider).platformStatisticsUrl
    : undefined

  const visibilityProps = showOptions.value ? ({ bar: "right", visible: true } as const) : { visible: false }

  if (platformStatisticsUrl) {
    res.push({
      name: "Usage",
      key: `${cmd}+u`,
      onPress: () => {
        // noinspection JSArrowFunctionBracesCanBeRemoved
        open(platformStatisticsUrl)
      },
      ...visibilityProps,
    })
  }

  res.push(
    {
      name: "System Prompt",
      key: `${cmd}+p`,
      onPress: async () => {
        await new ConfigureSystemPrompt().run()
        refreshHandle.value?.()
      },
      ...visibilityProps,
    },
    {
      name: "Model",
      key: `${cmd}+m`,
      onPress: async () => {
        await new SwitchModel().run()
        refreshHandle.value?.()
      },
      ...visibilityProps,
    },
  )

  res.push({
    name: showOptions.value ? "Hide Options" : "Show Options",
    key: `${cmd}+o`,
    onPress: () => {
      showOptions.value = !showOptions.value
    },
    bar: "right",
    visible: true,
  })

  //#endregion

  return res
})

function closeActionsPanel() {
  setFlagValue(undefined)
}

const selectedSuggestion = signal<{ text: string } | undefined>(undefined)

const ZERO_WIDTH_SPACE = " " // Make items appear at the top

const actions = computed(() => {
  if (selectedSuggestion.value) {
    return [
      {
        name: `${ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE}📤 Send`,
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
        name: `${ZERO_WIDTH_SPACE}📝 Use as template`,
        onAction() {
          batch(() => {
            setInput(selectedSuggestion.value!.text)
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

  const result: Action[] = []

  const sugg = currentSuggestions.value

  if (!sugg) {
    return result
  }

  const suggestionsMerged = [
    { prefix: ZERO_WIDTH_SPACE, text: `${sugg.moreExamplesQuestion}`, emoji: "➕" },
    ...sugg.followupQuestions.map((x) => ({
      group: "Suggestions",
      prefix: "",
      text: x.question,
      emoji: x.emoji,
    })),
  ] as const

  result.push(
    ...suggestionsMerged.flatMap((x) => [
      {
        name: `${x.prefix}${x.emoji} ${x.text}`,
        onAction: () => {
          selectedSuggestion.value = { text: x.text }
        },
        visible: true,
      },
    ]),
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

const currentProviderName = computed(() =>
  currentModel.value ? getProviderOrThrow(currentModel.value!.provider as Provider).name : undefined,
)

const footer = computed(() => {
  if (showOptions.value) {
    return "" // Not enough space
  }

  switch (currentStatus.value) {
    case Status.Responding: {
      return `${currentProviderName.value ?? "AI"} is responding...`
    }
    default:
      return currentStatus.value
  }
})

type Message = Awaited<ReturnType<typeof chat>>[number]

export default class Chat extends KitGptScreen<Message[] | undefined> {
  name = "chat"

  constructor(private passedValue?: string) {
    super()
  }

  async render({ refresh, refreshCount, signal }: RefreshableControls<Message[] | undefined>) {
    refreshHandle.value = refresh

    try {
      // noinspection JSArrowFunctionBracesCanBeRemoved
      return await chat({
        async onInit() {
          const effectHandles = [
            effect(() => setShortcuts(shortcuts.value)),
            effect(() => {
              if (actions.value.length === 0) {
                closeActionsPanel()
              } else {
                setActions(actions.value)
              }
            }),
            effect(() => setName(currentConversationTitle.value ?? "KitGPT")),
            effect(
              () =>
                currentModel.value && setDescription(`${currentModel.value.provider} - ${currentModel.value.modelId}`),
            ),
            effect(() => setFooter(footer.value)),
          ]

          const navigationEffectHandle = effect(() => {
            if (currentScreen.value !== "chat") {
              // Do not perform updates when we navigate away
              effectHandles.forEach((fn) => fn())
            }
          })

          signal.addEventListener("abort", () => {
            effectHandles.forEach((fn) => fn())
            navigationEffectHandle()
          })

          if (!currentModel.value) {
            await new SwitchModel().run()
            refresh()
            return
          }
        },
        width: PROMPT_WIDTH,
        height: CHAT_WINDOW_HEIGHT,
        input: refreshCount === 0 ? this.passedValue : undefined,
        shortcuts: shortcuts.value,
        placeholder: `✨ Ask ${currentProviderName.value ?? "AI"} anything...`,
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
          abortResponseStream()
        },
        onSubmit(content) {
          content && messages.push({ role: "user", content })
          refresh()
        },
      })
    } catch (err) {
      await showError(err)
      refresh()
    }
  }
}

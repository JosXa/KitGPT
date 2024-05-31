// noinspection ExceptionCaughtLocallyJS

import "@johnlindquist/kit"

import type { Shortcut } from "@johnlindquist/kit"
import { showError } from "@josxa/kit-utils"
import { batch, computed, effect, signal, untracked } from "@preact/signals-core"

import { writeFile } from "node:fs/promises"
import type { CoreMessage } from "ai"
import { deepSignal } from "deepsignal/core"
import { generateNewTitleForConversation } from "../ai/conversation-title"
import { streamTextWithSelectedModel } from "../ai/generate"
import { type Provider, getProviderOrThrow } from "../ai/models"
import { getSuggestions } from "../ai/suggestions"
import { CHAT_WINDOW_HEIGHT, PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../settings"
import { activeScreen } from "../store"
import { currentSuggestions } from "../store/chat"
import { currentConversationTitle, resetConversation } from "../store/conversations"
import { messages, subscribeToMessageEdits } from "../store/messages"
import { lastGeneratedScriptContent } from "../store/script-generator"
import { aiTools, currentModel, userDefinedTools } from "../store/settings"
import SubmitLinkEncoder from "../utils/SubmitLinkEncoder"
import { titleCase } from "../utils/string-utils"
import ConversationHistoryScreen from "./ConversationHistoryScreen"
import OptionsScreen from "./OptionsScreen"
import SwitchModelScreen from "./SwitchModelScreen"
import { KitGptScreen } from "./base/KitGptScreen"

export enum TOOL_RESULT_ACTION {
  SaveGeneratedScript = "save-generated-script",
  OpenGeneratedScriptInEditor = "open-in-editor",
  RunGeneratedScript = "run-script",
}

enum Status {
  Ready = "Ready",
  GettingSuggestions = "Getting suggestions...",
  Responding = "Responding...",
  CallingTool = "Calling custom tool...",
}

const refreshHandle = signal<(() => any) | undefined>(undefined)
const currentStatus = signal(Status.Ready)
const customToolCalled = signal<string | undefined>(undefined)

const currentResponseStream = signal<AbortController | null>(null)
const abortResponseStream = () => {
  currentResponseStream.value?.abort(new Error("Aborted"))
  currentResponseStream.value = null
}

effect(function abortWhenConversationResets() {
  if (messages.length === 0) {
    abortResponseStream()
    currentStatus.value = Status.Ready
  }
})

async function streamResponse() {
  abortResponseStream()
  currentResponseStream.value = new AbortController()

  try {
    const result = await streamTextWithSelectedModel({
      messages: messages,
      tools: aiTools.value,
      abortSignal: currentResponseStream.value.signal,
    })

    // Insert new message into the deep signal and get out a reactive version
    let generatingMessage: CoreMessage | undefined = undefined

    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") {
        if (chunk.textDelta.length > 0) {
          if (!generatingMessage) {
            generatingMessage =
              messages[
                messages.push({
                  role: "assistant",
                  content: "",
                }) - 1
              ]!
          }
          generatingMessage!.content += chunk.textDelta
        }
      } else if (chunk.type === "error") {
        // noinspection ExceptionCaughtLocallyJS
        throw chunk.error
      } else if (chunk.type === "tool-call") {
        currentStatus.value = Status.CallingTool
        customToolCalled.value = userDefinedTools.value[chunk.toolName]?.displayText ?? chunk.toolName
      }
    }

    currentResponseStream.value = null
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Aborted") {
      return // Ok
    }
    await showError(err, `An error occurred while generating a response from ${currentModel.value?.provider}`)
    refreshHandle.value?.()
  } finally {
    customToolCalled.value = undefined
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
  if (messages.length > 0 && messages[messages.length - 1]?.role === "user") {
    untracked(() => {
      currentStatus.value = Status.Responding
      streamResponse()
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
      await new ConversationHistoryScreen().run()
      refreshHandle.value?.()
    },
    bar: "left",
  })

  //#endregion

  //#region Right bar (options)

  res.push({
    id: "model",
    name: "Model",
    key: `${cmd}+m`,
    onPress: async () => {
      await new SwitchModelScreen().run()
      refreshHandle.value?.()
    },
    bar: "right",
    visible: true,
  })

  res.push({
    name: "Options",
    key: `${cmd}+o`,
    onPress: async () => {
      await new OptionsScreen().run()
      refreshHandle.value?.()
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

const actions = computed(() => {
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
    case Status.CallingTool: {
      return `${customToolCalled.value ?? "Calling custom tool"}...`
    }
    default:
      return currentStatus.value
  }
})

type Message = Awaited<ReturnType<typeof chat>>[number]

export default class ChatScreen extends KitGptScreen<Message[] | undefined> {
  name = "chat"

  constructor(private passedValue?: string) {
    super()
  }

  async render({ refresh, refreshCount, signal }) {
    const passedValue = this.passedValue
    refreshHandle.value = refresh

    try {
      // noinspection JSArrowFunctionBracesCanBeRemoved
      const result = (await chat({
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
            if (activeScreen.value !== "chat") {
              // Do not perform updates when we navigate away
              effectHandles.forEach((fn) => fn())
            }
          })

          signal.addEventListener("abort", () => {
            effectHandles.forEach((fn) => fn())
            navigationEffectHandle()
          })

          if (!currentModel.value) {
            await new SwitchModelScreen().run()
            refresh()
          }
        },
        width: PROMPT_WIDTH,
        height: CHAT_WINDOW_HEIGHT,
        input: refreshCount === 0 ? passedValue : undefined,
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
        },
      })) as Message[] | TOOL_RESULT_ACTION

      if (typeof result === "string" && SubmitLinkEncoder.canDecode(result)) {
        const decoder = SubmitLinkEncoder.decode(result)

        const writeLastGeneratedScript = async (filePath: string) => {
          if (!lastGeneratedScriptContent.value) {
            throw Error("No script contents found!")
          }
          await writeFile(filePath, lastGeneratedScriptContent.value, "utf-8")
        }

        switch (decoder.action) {
          case TOOL_RESULT_ACTION.SaveGeneratedScript: {
            const filePath = decoder.params.file!
            try {
              await writeLastGeneratedScript(filePath)
            } catch (err) {
              await showError(err)
            }
            return refresh()
          }
          case TOOL_RESULT_ACTION.OpenGeneratedScriptInEditor: {
            try {
              const filePath = decoder.params.file!
              await writeLastGeneratedScript(filePath)
              await edit(filePath)
            } catch (err) {
              await showError(err)
            }

            return refresh()
          }
          case TOOL_RESULT_ACTION.RunGeneratedScript: {
            try {
              const filePath = decoder.params.file!
              await writeLastGeneratedScript(filePath)
              await run(decoder.params.scriptName!)
            } catch (err) {
              await showError(err)
              return refresh()
            }

            exit() // Can't refresh after running a script anyway
          }
        }
      }

      return result
    } catch (err) {
      await showError(err)
      return refresh()
    }
  }
}

function isToolResultAction(result: Message[] | TOOL_RESULT_ACTION): result is TOOL_RESULT_ACTION {
  return typeof result === "string" && Object.values(TOOL_RESULT_ACTION).some((x) => result.startsWith(x))
}

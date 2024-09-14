// noinspection ExceptionCaughtLocallyJS

import "@johnlindquist/kit"

import type { PromptConfig, Shortcut } from "@johnlindquist/kit/types"
import { type RefreshableControls, showError } from "@josxa/kit-utils"
import { computed, effect, signal, untracked } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import { generateNewTitleForConversation } from "../../ai/conversation-title"
import { streamTextWithSelectedModel } from "../../ai/generate"
import { type Provider, getProviderOrThrow } from "../../ai/models"
import { getSuggestions } from "../../ai/suggestions"
import { CHAT_WINDOW_HEIGHT, PREVIEW_WIDTH_PERCENT, PROMPT_WIDTH } from "../../settings"
import { activeScreen } from "../../store"
import { currentConversationTitle, currentUnsentDraft } from "../../store/conversations"
import { messages } from "../../store/messages"
import { aiTools, currentModel, userDefinedTools } from "../../store/settings"
import { KitGptScreen } from "../base/KitGptScreen"
import SwitchModelScreen from "../options/SwitchModelScreen"
import { buildChatShortcuts } from "./shortcuts"
import { actions, closeActionsPanel } from "./suggestion-actions"

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

effect(function streamResponseOnUserMessage() {
  if (messages.length > 0 && messages[messages.length - 1]?.role === "user") {
    currentStatus.value = Status.Responding
    currentUnsentDraft.value = ""
    untracked(() => streamResponse())
  }
})

effect(function getSuggestionsOnAssistantMessage() {
  if (
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    currentResponseStream.value === null
  ) {
    currentStatus.value = Status.GettingSuggestions
    getSuggestions().finally(() => {
      if (currentStatus.value === Status.GettingSuggestions) {
        currentStatus.value = Status.Ready
      }
    })
  }
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

export default abstract class AbstractChatScreen<T> extends KitGptScreen<T> {
  abstract initEffects(): Generator<() => void, void>

  protected getExtraShortcuts(): Shortcut[] {
    return []
  }

  protected isResponseInProgress = computed(() => currentResponseStream.value !== null)

  protected buildPromptConfig({ refresh, signal: abortSignal }: RefreshableControls<T>): PromptConfig {
    const self = this
    refreshHandle.value = refresh

    const finalShortcuts = computed(() => [...buildChatShortcuts(refresh), ...this.getExtraShortcuts()])

    return {
      async onInit() {
        const effectHandles = [
          effect(() => setShortcuts(finalShortcuts.value)),
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
          ...self.initEffects(),
        ]

        const navigationEffectHandle = effect(() => {
          if (activeScreen.value !== self.name) {
            // Do not perform updates when we navigate away
            effectHandles.forEach((fn) => fn())
          }
        })

        abortSignal.addEventListener("abort", () => {
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
      shortcuts: finalShortcuts.value,
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
      onEscape() {
        abortResponseStream()
      },
    }
  }
}

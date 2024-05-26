import type { Choice } from "@johnlindquist/kit"
import { refreshable } from "@josxa/kit-utils"
import { batch } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import type { Conversation } from "./schema"
import { PROMPT_WIDTH } from "./settings"
import {
  currentConversationId,
  currentConversationTitle,
  deleteConversation,
  getAllConversationMetadata,
  getFullConversation,
  messages,
} from "./store"

const titleCase = (str: string) => {
  if (!str) {
    return ""
  }
  return str[0]?.toUpperCase() + str.slice(1)
}

function buildPreview(convo: Conversation) {
  return md(
    convo.messages
      ?.map((m: CoreMessage) =>
        `
<b style="color: rgba(var(--color-primary), var(--tw-text-opacity))">${
          m.role === "user" ? "You" : titleCase(m.role)
        }</b>: ${m.content}`.trim(),
      )
      .join("\n\n") ?? "No messages",
  )
}

let cache = new Map<number, Conversation>()

const getFullConvoCached = async (conversationId: number) => {
  if (cache.has(conversationId)) {
    return cache.get(conversationId)!
  }
  const val = await getFullConversation(conversationId)
  cache.set(conversationId, val)
  return val
}

export async function showConversationHistory() {
  cache = new Map()
  return await refreshable<void>(async ({ refresh, resolve }) => {
    const metadata = await getAllConversationMetadata()

    const selectedConvoId = await arg<number>({
      placeholder: "Conversation History",
      width: PROMPT_WIDTH,
      choices: metadata.map(
        (convo) =>
          ({
            name: convo.title ?? "Untitled",
            description: `Started: ${convo.started}`,
            value: convo.id,
            preview: async () => {
              const details = await getFullConvoCached(convo.id)
              return buildPreview(details)
            },
            actions: [
              {
                name: "Load Conversation",
                description: "Opens this conversation",
                shortcut: `${cmd}+o`,
                visible: true,
                async onAction() {
                  await loadConversation(convo.id)
                  resolve()
                },
              },
              {
                name: "Rename",
                description: "Give this conversation a different title",
                shortcut: `${cmd}+r`,
                visible: true,
                async onAction() {
                  await div("Not implemented")
                  refresh()
                },
              },
              {
                name: "Delete",
                description: "Goodbye...",
                shortcut: `${cmd}+d`,
                visible: true,
                async onAction() {
                  await deleteConversation(convo.id)
                  refresh()
                },
              },
            ],
          }) satisfies Choice<number>,
      ),
      preload: true,
      hasPreview: true,
      shortcuts: [
        {
          name: "Back to Chat",
          key: "escape",
          visible: true,
          bar: "right",
          onPress() {
            resolve()
          },
        },
        {
          name: "Back to Chat",
          key: `${cmd}+h`,
          visible: false,
          bar: "right",
          onPress() {
            resolve()
          },
        },
      ],
    })

    if (selectedConvoId) {
      await loadConversation(selectedConvoId)
    }
  })
}

async function loadConversation(conversationId: number) {
  const conversation = await getFullConvoCached(conversationId)
  messages.splice(0, messages.length)
  batch(() => messages.push(...(conversation.messages ?? [])))
  currentConversationId.value = conversation.id
  currentConversationTitle.value = conversation.title ?? "Untitled"
}

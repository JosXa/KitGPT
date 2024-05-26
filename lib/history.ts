import type { Choice } from "@johnlindquist/kit"
import type { CoreMessage } from "ai"
import { PROMPT_WIDTH } from "./settings"
import { getConversations } from "./store"

const titleCase = (str: string) => {
  if (!str) {
    return ""
  }
  return str[0]?.toUpperCase() + str.slice(1)
}

export async function showConversationHistory() {
  // biome-ignore lint/suspicious/noAsyncPromiseExecutor: Should be safe
  return new Promise<void>(async (resolve, reject) => {
    try {
      const convos = await getConversations()
      const choices: Choice<number | bigint>[] = convos.map(({ id, messages, started, title }) => ({
        name: title ?? "Untitled",
        description: `Started: ${started}`,
        value: id,
        preview: async () =>
          md(
            messages?.map((m: CoreMessage) => `**${titleCase(m.role)}**\n\n${m.content}`).join("\n\n") ?? "No messages",
          ),
      }))
      await arg({
        placeholder: "Conversation History",
        width: PROMPT_WIDTH,
        choices,
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
    } catch (err) {
      reject(err)
    }
  })
}

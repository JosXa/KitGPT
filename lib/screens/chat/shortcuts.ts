import type { Shortcut } from "@johnlindquist/kit/types"
import type { FORCE_REFRESH } from "@josxa/kit-utils"
import { resetConversation } from "../../store/conversations"
import { messages } from "../../store/messages"
import { chatMode } from "../../store/settings"
import ConversationHistoryScreen from "../ConversationHistoryScreen"
import OptionsScreen from "../OptionsScreen"
import SwitchModelScreen from "../SwitchModelScreen"

export function buildChatShortcuts(refresh: () => typeof FORCE_REFRESH): Shortcut[] {
  const res: Shortcut[] = [
    {
      name: "Close",
      key: `${cmd}+w`,
      onPress: () => exit(),
      bar: "left",
    },
  ]

  if (messages.length > 0) {
    res.push({
      name: "New",
      key: `${cmd}+n`,
      onPress: () => {
        resetConversation()
        refresh()
      },
      bar: "left",
    })
  }

  res.push({
    name: "History",
    key: `${cmd}+h`,
    onPress: async () => {
      await new ConversationHistoryScreen().run()
      refresh()
    },
    bar: "left",
  })

  res.push({
    name: chatMode.value === "chat" ? "Editor" : "Chat",
    key: `${cmd}+e`,
    onPress: async () => {
      // TODO: Clean this up
      if (chatMode.value === "chat") {
        chatMode.value = "editor"
        // noinspection JSPotentiallyInvalidConstructorUsage
        await new (await import("./EditorChatScreen")).default().run()
      } else {
        chatMode.value = "chat"
        // noinspection JSPotentiallyInvalidConstructorUsage
        await new (await import("./ChatScreen")).default().run()
      }
      // TODO: Resolve
    },
    bar: "left",
  })

  res.push({
    id: "model",
    name: "Model",
    key: `${cmd}+m`,
    onPress: async () => {
      await new SwitchModelScreen().run()
      refresh()
    },
    bar: "right",
    visible: true,
  })

  res.push({
    name: "Options",
    key: `${cmd}+o`,
    onPress: async () => {
      await new OptionsScreen().run()
      refresh()
    },
    bar: "right",
    visible: true,
  })

  return res
}

import type { Shortcut } from "@johnlindquist/kit/types"
import type { FORCE_REFRESH } from "@josxa/kit-utils"
import { SHORTCUTS } from "../../settings"
import { resetConversation } from "../../store/conversations"
import { messages } from "../../store/messages"
import { chatMode } from "../../store/settings"
import ConversationHistoryScreen from "../ConversationHistoryScreen"
import OptionsScreen from "../options/OptionsScreen"
import SwitchModelScreen from "../options/SwitchModelScreen"

export function buildChatShortcuts(refresh: () => typeof FORCE_REFRESH): Shortcut[] {
  const res: Shortcut[] = [
    {
      ...SHORTCUTS.close,
      onPress: () => exit(),
    },
  ]

  if (messages.length > 0) {
    res.push({
      ...SHORTCUTS.newConversation,
      onPress: () => {
        resetConversation()
        refresh()
      },
    })
  }

  res.push({
    ...SHORTCUTS.history,
    onPress: async () => {
      await new ConversationHistoryScreen().run()
      refresh()
    },
  })

  res.push({
    ...(chatMode.value === "chat" ? SHORTCUTS.switchToEditor : SHORTCUTS.switchToChat),
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
  })

  res.push({
    ...SHORTCUTS.changeModel,
    onPress: async () => {
      await new SwitchModelScreen().run()
      refresh()
    },
  })

  res.push({
    ...SHORTCUTS.options,
    onPress: async () => {
      await new OptionsScreen().run()
      refresh()
    },
  })

  return res
}

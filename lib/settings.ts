import type { Shortcut } from "@johnlindquist/kit/types"

export const PROMPT_WIDTH = 1150 as const
export const CHAT_WINDOW_HEIGHT = 800 as const
export const PREVIEW_WIDTH_PERCENT = 50 as const

export const NUM_SUGGESTIONS = 5 as const

export const SHORTCUTS = {
  close: {
    name: "Close",
    key: `${cmd}+w`,
    bar: "left",
  },
  newConversation: {
    name: "New",
    key: `${cmd}+n`,
    bar: "left",
  },
  history: {
    name: "History",
    key: `${cmd}+h`,
    bar: "left",
  },
  switchToEditor: {
    name: "Editor",
    key: `${cmd}+e`,
    bar: "left",
  },
  switchToChat: {
    name: "Chat",
    key: `${cmd}+e`,
    bar: "left",
  },
  changeModel: {
    id: "model",
    name: "Model",
    key: `${cmd}+m`,
    bar: "right",
    visible: true,
  },
  options: {
    name: "Options",
    key: `${cmd}+o`,
    bar: "right",
    visible: true,
  },
} as const satisfies Record<string, Omit<Shortcut, "onPress" | "flag" | "condition">>

import { signal } from "@preact/signals-core"
import "./conversations"
import "./settings"
import "./chat"

export const activeScreen = signal<string | undefined>(undefined)

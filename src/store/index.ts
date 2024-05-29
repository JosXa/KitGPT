import { signal } from "@preact/signals-core"
import "./conversations"
import "./settings"
import "./chat"

export const currentScreen = signal<string | undefined>(undefined)

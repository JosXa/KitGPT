import { signal } from "@preact/signals-core"

export const lastGeneratedScriptContent = signal<string | undefined>(undefined)

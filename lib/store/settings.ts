import { computed, signal } from "@preact/signals-core"
import type { getModel } from "../ai/models"
import type { KitGptTool } from "../ai/tool-calling"
import { settingsDb } from "../database/settings-db"
import { mapObjectEntries } from "../utils/typed-objects"
import { chatControls } from "./messages"

export const currentModel = signal<undefined | Awaited<ReturnType<typeof getModel>>>(undefined)

// TODO: Add model settings (e.g. temperature, max tokens, etc.)
// export type ModelSetings = {}
// export const currentModelSettings = signal()

export const systemPrompt = signal(settingsDb.systemPrompt)
export const welcomeShown = signal(settingsDb.welcomeShown)

export const userDefinedTools = signal<Record<string, KitGptTool>>({})

export const aiTools = computed(() =>
  mapObjectEntries(userDefinedTools.value, ([name, { description, parameters, execute }]) => [
    name,
    {
      description,
      parameters,
      execute: async (args: any) => await execute(chatControls, args),
    },
  ]),
)

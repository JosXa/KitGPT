import { effect, signal } from "@preact/signals-core"
import { type Provider, getModel } from "../ai/models"
import { debouncedWriteSettings, settingsDb } from "../database/settings-db"

export const currentModel = signal(
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined,
)

// TODO: Add model settings (e.g. temperature, max tokens, etc.)
// export type ModelSetings = {}
// export const currentModelSettings = signal()

export const systemPrompt = signal(settingsDb.systemPrompt)
export const welcomeShown = signal(settingsDb.welcomeShown)

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.welcomeShown = welcomeShown.value
  settingsDb.modelId = currentModel.value?.modelId
  settingsDb.provider = currentModel.value?.provider as Provider

  debouncedWriteSettings()
})

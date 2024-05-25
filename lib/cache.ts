import "@johnlindquist/kit"
import type { openai } from "@ai-sdk/openai"
import { effect, signal, untracked } from "@preact/signals-core"
import { type Provider, getModel } from "./models"

type DbData = {
  modelId: Parameters<typeof openai>[0]
  provider: Provider
  systemPrompt: string // TODO: Extend to support a collection
}
const cache = await db({
  modelId: "gpt-4o",
  provider: "openai.chat",
  systemPrompt: "You are a helpful, respectful and honest assistant.",
} as DbData)

export const model = signal(await getModel(cache.provider, cache.modelId))
export const systemPrompt = signal(cache.systemPrompt)

const debouncedWriteCache = debounce(cache.write, 1000, {
  leading: false,
  trailing: true,
})

let firstRun = true
effect(() => {
  cache.systemPrompt = systemPrompt.value
  cache.modelId = model.value.modelId
  cache.provider = model.value.provider as Provider

  !firstRun && debouncedWriteCache()
  firstRun = false
})

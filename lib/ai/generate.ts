import { generateObject, generateText, streamText } from "ai"
import SwitchModelScreen from "../screens/SwitchModelScreen"
import { currentModel, systemPrompt } from "../store/settings"

const ensureModelSelected = async () => {
  while (!currentModel.value) {
    await new SwitchModelScreen().run()
  }
  return currentModel.value!
}

export async function streamTextWithSelectedModel(streamTextArgs: Omit<Parameters<typeof streamText>[0], "model">) {
  const model = await ensureModelSelected()

  if (streamTextArgs.system === undefined) {
    streamTextArgs.system = systemPrompt.value
  }

  return await streamText({
    model,
    ...streamTextArgs,
  })
}

export async function generateTextWithSelectedModel(
  generateTextArgs: Omit<Parameters<typeof generateText>[0], "model">,
) {
  const model = await ensureModelSelected()

  if (generateTextArgs.system === undefined) {
    generateTextArgs.system = systemPrompt.value
  }

  return await generateText({
    model,
    ...generateTextArgs,
  })
}

export async function generateObjectWithSelectedModel(
  generateObjectArgs: Omit<Parameters<typeof generateObject>[0], "model">,
) {
  const model = await ensureModelSelected()

  if (generateObjectArgs.system === undefined) {
    generateObjectArgs.system = systemPrompt.value
  }

  return await generateObject({
    model,
    mode: "json",
    ...generateObjectArgs,
  })
}

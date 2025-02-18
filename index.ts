import { effect } from "@preact/signals-core"
import { type Provider, getModel } from "./lib/ai/models"
import { KitGptTool } from "./lib/ai/tool-calling"
import { ensureDbInitialized } from "./lib/database/db"
import { debouncedWriteSettings, settingsDb } from "./lib/database/settings-db"
import WelcomeScreen from "./lib/screens/WelcomeScreen"
import ChatScreen from "./lib/screens/chat/ChatScreen"
import EditorChatScreen from "./lib/screens/chat/EditorChatScreen"
import { chatMode, currentModel, systemPrompt, userDefinedTools, welcomeShown } from "./lib/store/settings"
export { TOOL_RESULT_ACTION } from "./lib/screens/chat/ChatScreen"
export { generateKitScript } from "./lib/ai/kit-script-generator"
export { streamTextWithSelectedModel, generateTextWithSelectedModel } from "./lib/ai/generate"
export { kitGptTool } from "./lib/ai/tool-calling"

currentModel.value =
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.welcomeShown = welcomeShown.value
  settingsDb.modelId = currentModel.value?.modelId
  settingsDb.provider = currentModel.value?.provider as Provider
  settingsDb.chatMode = chatMode.value

  debouncedWriteSettings()
})

export async function kitGpt(tools: Record<string, KitGptTool> = {}) {
  userDefinedTools.value = tools

  await ensureDbInitialized(({ backupPath }) =>
    div(
      md(
        "## Database corrupted\n\n" +
          `The conversations database appears to be corrupted. Creating a backup at <code>${backupPath}</code> and 
        attempting to recreate it.`,
      ),
    ),
  )

  if (!welcomeShown.value) {
    await new WelcomeScreen().run()
  }

  // TODO: Bring it back
  const passedValue = flag.pass as string | undefined

  switch (chatMode.value) {
    case "chat":
      return await new ChatScreen().run()
    case "editor":
      return await new EditorChatScreen().run()
  }
}

export { KitGptTool }

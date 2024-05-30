// Name: KitGPT
// Description: Chat with a variety of LLMs
// Author: @JosXa
// Trigger: chat
// Shortcut: cmd alt ä
// Pass: True

import "@johnlindquist/kit"
// Cache: false (custom metadata)

import { ensureDbInitialized } from "../lib/database/db"
import ChatScreen from "../lib/screens/ChatScreen"
import WelcomeScreen from "../lib/screens/WelcomeScreen"
import { welcomeShown } from "../lib/store/settings"

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

const passedValue = flag.pass as string | undefined

await new ChatScreen(passedValue).run()

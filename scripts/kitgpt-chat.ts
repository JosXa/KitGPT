// Name: KitGPT
// Description: Chat with a variety of LLMs
// Author: @JosXa
// Trigger: chat
// Shortcut: cmd alt ä
// Pass: True

import "@johnlindquist/kit"

import Chat from "../src/screens/Chat"

import { ensureDbInitialized } from "../src/database/db"
import Welcome from "../src/screens/Welcome"

import { welcomeShown } from "../src/store/settings"

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
  await new Welcome().run()
}

const passedValue = flag.pass as string | undefined

await new Chat(passedValue).run()

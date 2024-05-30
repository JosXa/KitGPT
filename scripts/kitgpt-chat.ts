// Name: KitGPT
// Description: Chat with a variety of LLMs
// Author: @JosXa
// Trigger: chat
// Shortcut: cmd alt ä
// Pass: True
// Cache: false (custom metadata)

import "@johnlindquist/kit"
import { z } from "zod"
import { generateKitScript, kitGpt, kitGptTool } from ".."

await kitGpt({
  weather: kitGptTool({
    description: "Get the weather in a location",
    parameters: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
    // biome-ignore lint/suspicious/useAwait: Should figure out how to make this work without promises at some point...
    execute: async (chat, { location }) => {
      const temperature = 72 + Math.floor(Math.random() * 21) - 10
      chat.send(`The weather in ${location} is ${temperature}°F`)
    },
  }),

  kitScriptGenerator: kitGptTool({
    description: "Generate a Kit script (write a Script Kit script)",
    parameters: z.object({
      name: z.string().describe("The name of the script for its metadata"),
      requirements: z.string().describe("What the script should do"),
    }),
    execute: async (chat, { name, requirements }) => {
      const script = await generateKitScript({ name, requirements })
      setProgress(20)
      chat.appendLine(requirements)
      const nameMetadata = `// Name: ${name}`
      const fileName = `${name.replaceAll(" ", "-").toLowerCase()}.ts`
      await wait(2000)
      setProgress(80)
      chat.appendLine(`Chose the name ${name}.`)
      await wait(1000)
      chat.appendLine(`I generated this at <code>'${fileName}'</code> for you:`)
      chat.send(script)
      setProgress(-1)
    },
  }),
})

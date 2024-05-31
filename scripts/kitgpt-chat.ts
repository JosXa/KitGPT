// Name: KitGPT
// Description: Chat with a variety of LLMs
// Author: @JosXa
// Trigger: chat
// Shortcut: cmd alt ä
// Pass: True
// Cache: false (custom metadata)

import "@johnlindquist/kit"
import { writeFile } from "node:fs/promises"
import { z } from "zod"
import { generateKitScript, kitGpt, kitGptTool } from ".."
import { TOOL_RESULT_ACTION } from "../lib/screens/ChatScreen"
import { lastGeneratedScriptContent } from "../lib/store/script-generator"
import SubmitLinkEncoder from "../lib/utils/SubmitLinkEncoder"

await kitGpt({
  weather: kitGptTool({
    displayText: "Getting the weather",
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
    displayText: "Generating a Kit script",
    parameters: z.object({
      name: z.string().describe("The human-readable name of the script"),
      requirements: z.string().describe("What the script should do"),
      fileExtension: z
        .enum([".ts", ".js"])
        .describe("Whether this should be a TypeScript ('.ts') or JavaScript ('.js') file"),
    }),
    execute: async (chat, { name, requirements, fileExtension }) => {
      chat.send(md(`## Task\n${requirements}`))
      setProgress(20)

      const script = await generateKitScript({ name, requirements, typeScript: fileExtension === ".ts" })

      const scriptName = name.replaceAll(" ", "-").toLowerCase()
      const fileName = `${scriptName}${fileExtension}`
      const filePath = kenvPath("scripts", fileName)

      setProgress(-1)
      chat.appendLine(`Here is the <b>${name}</b> script you requested.`)
      chat.send(md(`~~~${fileExtension.replace(".", "")}\n${script.replaceAll("~~~", "")}\n~~~`))

      const save = new SubmitLinkEncoder(TOOL_RESULT_ACTION.SaveGeneratedScript, { file: filePath })

      const openInEditor = new SubmitLinkEncoder(TOOL_RESULT_ACTION.OpenGeneratedScriptInEditor, { file: filePath })

      const runScript = new SubmitLinkEncoder(TOOL_RESULT_ACTION.RunGeneratedScript, { file: filePath, scriptName })

      chat.appendLine(md(`**After your review**, I can add it to your kenv as <code>${filePath}<code>.`))

      chat.appendLine(
        md(
          [
            save.toMarkdownLink("Save"),
            openInEditor.toMarkdownLink("Save and open in editor"),
            runScript.toMarkdownLink("Save and run"),
          ].join(" | "),
        ),
      )
    },
  }),
})

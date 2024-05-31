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
      chat.appendLine(requirements)
      setProgress(20)

      const script = await generateKitScript({ name, requirements, typeScript: fileExtension === ".ts" })

      const scriptName = name.replaceAll(" ", "-").toLowerCase()
      const fileName = `${scriptName}${fileExtension}`
      const filePath = kenvPath("scripts", fileName)

      await writeFile(filePath, script, "utf8")

      setProgress(-1)
      chat.appendLine(`I generated the <b>${name}</b> script at <code>scripts/${fileName}</code> for you:`)
      chat.send(md(`~~~${fileExtension.replace(".", "")}\n${script.replaceAll("~~~", "")}\n~~~`))

      const openInEditor = new SubmitLinkEncoder(TOOL_RESULT_ACTION.OpenInEditor)
      openInEditor.setParam("file", filePath)

      const runScript = new SubmitLinkEncoder(TOOL_RESULT_ACTION.RunScript)
      runScript.setParam("scriptName", scriptName)

      chat.appendLine(
        md(`${openInEditor.toMarkdownLink("Open in Editor")} | ${runScript.toMarkdownLink("Run Script")}`),
      )
    },
  }),
})

// Name: KitGPT
// Description: Chat with a variety of LLMs
// Author: @JosXa
// Trigger: chat
// Shortcut: cmd alt ä
// Pass: True
// Cache: false (custom metadata)

import "@johnlindquist/kit"
import { z } from "zod"
import { TOOL_RESULT_ACTION, generateKitScript, kitGpt, kitGptTool } from ".."
import SubmitLinkEncoder from "../lib/utils/SubmitLinkEncoder"

await kitGpt({
  kitScriptGenerator: kitGptTool({
    description: "Generate a Kit script. Only triggered when the user explicitly prompts 'write a script that...'",
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

      chat.send(md(`**After your review**, I can add it to your kenv as <code>${filePath}<code>.`))

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
  // linkBuilder: kitGptTool({
  //   description: "Insert/Add hyperlinks, google terms",
  //   parameters: z.object({
  //     text: z
  //       .string()
  //       .describe("The message where important words, terms, and brands ought to be turned into clickable hyperlinks"),
  //   }),
  //   async execute(chat, { text }) {
  //     const res = await generateTextWithSelectedModel({
  //       system:
  //         "Surround all words, terms and brands that would benefit from clickable hyperlinks with links in markdown syntax. " +
  //         "If you are sure about a URL (e.g. because it's short like `https://telegram.org`), just use that URL. Otherwise, " +
  //         "use either a google search URL https://www.google.com/search?q=TERM or a Wikipedia one in the correct language " +
  //         "(e.g. English https://en.wikipedia.org/wiki/TERM or German https://de.wikipedia.org/wiki/TERM).",
  //       prompt: text,
  //     })
  //     chat.send(res.text)
  //   },
  // }),
})

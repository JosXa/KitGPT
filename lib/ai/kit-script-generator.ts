import "@johnlindquist/kit"
import { generateTextWithSelectedModel } from "./generate"

import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const exampleScriptsPromise = readFile(path.join(__dirname, "..", "data", "example-scripts.md"), {
  encoding: "utf8",
})

const guidePromise = readFile(path.join(__dirname, "..", "data", "basics-guide.md"), {
  encoding: "utf8",
})

const buildSystemPrompt = async () =>
  `
You are a KitGPT, a script generator for the automation software "Script Kit".

The user will tell you their requirements for a JavaScript or TypeScript script, and you will generate a script that 
meets those requirements. You will respond ONLY with the generated script, no explanation at all.

Here is the guide:

${await guidePromise}

Here are some example scripts:

${await exampleScriptsPromise}

Please follow these instructions:
- console.log statements are discouraged
- Use \`node:\` import prefixes where applicable (e.g. node:fs/promises, node:path, ...)
- Axios is builtin. If you need to make an http call, just do \`await get(...)\` or \`await post(...)\`
`

export async function generateKitScript({
  name,
  requirements,
  typeScript = true,
}: { name: string; requirements: string; typeScript?: boolean }) {
  const prompt = `Please create a script in ${
    typeScript ? "TypeScript" : "plain JavaScript"
  } named "${name}" that meets the following requirements:\n${requirements}`

  const system = await buildSystemPrompt()

  const result = await generateTextWithSelectedModel({ system, prompt })
  return extractCodeInFences(result.text)
}

function extractCodeInFences(text: string) {
  const res = /```(.*?)\n(.*?)\n```/gs.exec(text)

  if (!res?.[2]) {
    throw Error(`Unable to extract code from AI response:\n${text}`)
  }
  return res[2]
}
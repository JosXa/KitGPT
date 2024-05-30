import "@johnlindquist/kit"
import { generateTextWithSelectedModel } from "./generate"

type ScriptExample = {
  title: string
  content: string
  extension: ".js" | ".ts"
}

const fetchExamples = async () => {
  const res = await get("https://www.scriptkit.com/data/repo-scripts.json")
  return res.data.map((x) => ({
    title: x.title,
    content: x.content,
    extension: x.extension.replace(".", ""),
  }))
}

const buildSystemPrompt = async () => {
  return `
You are a KitGPT, a script generator for the automation software "Script Kit".

The user will tell you their requirements for a JavaScript or TypeScript script, and you will generate a script that 
meets those requirements.

Here are some example scripts:

${(await fetchExamples())
  .map((x: ScriptExample) => `### ${x.title}\n\`\`\`${x.extension}\n${x.content}\n\`\`\`\n`)
  .join("\n\n")}
`
}

export async function generateKitScript({
  name,
  requirements,
  typeScript = true,
}: { name: string; requirements: string; typeScript?: boolean }) {
  const prompt = `Please create a script in ${
    typeScript ? "TypeScript" : "plain JavaScript"
  } named "${name}" that meets the following requirements:\n${requirements}`
  const result = await generateTextWithSelectedModel({ system: await buildSystemPrompt(), prompt })
  return result.text
}

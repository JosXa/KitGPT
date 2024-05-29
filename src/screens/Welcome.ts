import { ALL_PROVIDER_NAMES } from "../ai/models"
import { PROMPT_WIDTH } from "../settings"
import { currentModel, welcomeShown } from "../store/settings"
import { KitGptScreen } from "./base/KitGptScreen"

export default class Welcome extends KitGptScreen<void> {
  name = "Welcome"

  async render() {
    await div({
      width: PROMPT_WIDTH,
      html: md(
        `# Welcome to <b style="color: rgba(var(--color-primary), var(--tw-text-opacity))">KitGPT</b>!

## Your AI-powered assistant, now integrated with Script Kit!

KitGPT lets you chat with models from the following providers for top-tier AI assistance:
- ${ALL_PROVIDER_NAMES.join("\n- ")}

Whether you're coding, brainstorming, or need quick answers, KitGPT is just one shortcut away.
Feel free to tweak it as needed!

${
  currentModel.value
    ? ""
    : "Next, I'll guide you through obtaining an **access token** for your **preferred provider**. ➡"
}`.trim(),
      ),
    })

    welcomeShown.value = true
  }
}

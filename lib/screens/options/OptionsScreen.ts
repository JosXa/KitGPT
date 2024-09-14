import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { Choice } from "@johnlindquist/kit/types"
import { type RefreshableControls, showError } from "@josxa/kit-utils"
import { signal } from "@preact/signals-core"
import { type Provider, getProviderOrThrow } from "../../ai/models"
import { PROMPT_WIDTH } from "../../settings"
import { currentModel } from "../../store/settings"
import { KitGptScreen } from "../base/KitGptScreen"
import ConfigureSystemPromptScreen from "./ConfigureSystemPromptScreen"
import ModelSettingsScreen from "./ModelSettingsScreen"
import SwitchModelScreen from "./SwitchModelScreen"

const __dirname = dirname(fileURLToPath(import.meta.url))

const focuseChoiceId = signal<string | undefined>(undefined)

const openDrizzleStudio = async () => {
  const projectRoot = path.join(__dirname, "..")
  await term({ command: "npm run db:studio", cwd: projectRoot })
}

const buildChoices = (refresh: () => void) => {
  const res: Choice[] = []

  res.push(
    {
      id: "system-prompt",
      name: "Edit System Prompt",
      shortcut: `${cmd}+p`,
      onSubmit: async () => {
        await new ConfigureSystemPromptScreen().run()
        refresh()
        return preventSubmit
      },
    },
    {
      id: "model",
      name: "Switch Provider / Model",
      shortcut: `${cmd}+m`,
      onSubmit: async () => {
        await new SwitchModelScreen().run()
        refresh()
        return preventSubmit
      },
    },
    {
      id: "model-settings",
      name: "Model Settings",
      shortcut: `${cmd}+p`,
      onSubmit: async () => {
        await new ModelSettingsScreen().run()
        refresh()
        return preventSubmit
      },
    },
    {
      id: "conversations-db",
      name: "Show Conversations Database",
      onSubmit: async () => {
        try {
          await openDrizzleStudio()
        } catch (err) {
          await showError(err, "Unable to start Drizzle Studio")
        }

        refresh()
        return preventSubmit
      },
    },
  )

  const platformStatisticsUrl = currentModel.value
    ? getProviderOrThrow(currentModel.value.provider as Provider).platformStatisticsUrl
    : undefined

  if (platformStatisticsUrl) {
    res.push({
      id: "show-platform-usage",
      name: "Show Platform Usage (opens in browser)",
      shortcut: `${cmd}+u`,
      onSubmit: () => {
        // noinspection JSArrowFunctionBracesCanBeRemoved
        open(platformStatisticsUrl)
        return preventSubmit
      },
    })
  }

  return res
}

export default class OptionsScreen extends KitGptScreen<void> {
  name = "options"

  async render({ refresh, resolve }: RefreshableControls<void>) {
    const choices = buildChoices(refresh)
    await arg(
      {
        width: PROMPT_WIDTH,
        focusedId: focuseChoiceId.value ?? choices[0]!.id,
        placeholder: "Configure KitGPT",
        onEscape() {
          resolve()
        },
        onChoiceFocus(_, state) {
          if (state?.index !== undefined) {
            focuseChoiceId.value = state.focused!.id
          }
        },
        shortcuts: [
          {
            name: "Back to Chat",
            key: "escape",
            visible: true,
            bar: "right",
            onPress() {
              resolve()
            },
          },
        ],
      },
      choices,
    )
    refresh()
  }
}

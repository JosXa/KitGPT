import { type RefreshableControls, startSpinner } from "@josxa/kit-utils"
import { PROVIDERS, testProvider } from "../ai/models"
import { PROMPT_WIDTH } from "../settings"
import { currentModel } from "../store/settings"
import { typedObjectEntries } from "../utils/typed-objects"
import { KitGptScreen } from "./base/KitGptScreen"

export default class SwitchModel extends KitGptScreen<void> {
  name = "switch-model"

  async render({ refresh, resolve }: RefreshableControls<void>) {
    const canAbort = !!currentModel.value

    const providerKey = await select(
      {
        hint: "Please select a provider",
        multiple: false,
        width: PROMPT_WIDTH,
        strict: true,
        defaultValue: currentModel.value?.provider,
        shortcuts: canAbort
          ? [
              {
                name: "Back to Chat",
                key: "escape",
                visible: true,
                bar: "right",
                onPress() {
                  resolve()
                },
              },
              {
                name: "Back to Chat",
                key: `${cmd}+m`,
                visible: false,
                bar: "right",
                onPress() {
                  resolve()
                },
              },
            ]
          : undefined,
      },
      typedObjectEntries(PROVIDERS).map(([key, p]) => ({
        name: p.name,
        value: key,
      })),
    )

    const provider = PROVIDERS[providerKey]

    await provider.ensureAuthenticated({
      width: PROMPT_WIDTH,
      shortcuts: [
        {
          name: "Cancel",
          key: "escape",
          visible: true,
          bar: "right",
          onPress() {
            refresh()
          },
        },
      ],
    })

    const modelId = await select<string>(
      {
        hint: `Please select the ${provider.name} chat completion model`,
        width: PROMPT_WIDTH,
        multiple: false,
        strict: false,
        defaultValue: currentModel.value?.modelId,
        shortcuts: [
          {
            name: "Go Back to Provider Selection",
            key: "escape",
            visible: true,
            bar: "right",
            onPress() {
              refresh()
            },
          },
        ],
      },
      provider.knownModels,
    )

    currentModel.value = await provider.getModel(modelId)

    const spinner = startSpinner("spaceX", { initialMessage: "Testing connection..." }, { width: PROMPT_WIDTH })
    const testResult = await testProvider()
    spinner.stop()

    if (!testResult.ok) {
      await div({
        html: md(`# Cannot connect to ${currentModel.value.provider}
      
**Error:** <u>${testResult.error}</u>

In case your access token is expired, please edit your \`~/.kenv/.env\` file.`),
        width: PROMPT_WIDTH,
      })
    }
  }
}

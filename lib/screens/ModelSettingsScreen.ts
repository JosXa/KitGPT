import type { RefreshableControls } from "@josxa/kit-utils"
import { KitGptScreen } from "./base/KitGptScreen"

// TODO: Implement (temperature, tokens, etc.)
export default class ModelSettingsScreen extends KitGptScreen<void> {
  name = "model-settings"

  async render({ refresh, resolve }: RefreshableControls<void>) {
    await div({
      html: "Coming soon: Configure Temperature, max tokens, etc.",
      onEscape() {
        resolve()
      },
      shortcuts: [
        {
          name: "Back",
          key: "escape",
          onPress: () => resolve(),
          visible: false,
        },
      ],
    })
    // await form({})
  }
}

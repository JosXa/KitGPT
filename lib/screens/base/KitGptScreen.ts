import { refreshable } from "@josxa/kit-utils"
import type { RefreshableControls } from "@josxa/kit-utils"

import { currentScreen } from "../../store"

export abstract class KitGptScreen<T> {
  protected abstract name: string

  protected abstract render(controls: RefreshableControls<T>): Promise<T>

  /**
   * Wraps around the given render function to update the state which screen is currently active
   * (so that setActions calls don't interfere).
   */
  public async run(): Promise<T> {
    const result = await refreshable<T>((controls) => {
      currentScreen.value = this.name
      return this.render(controls)
    })
    currentScreen.value = undefined
    return result
  }
}

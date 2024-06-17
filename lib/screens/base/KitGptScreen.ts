import { type FORCE_REFRESH, refreshable } from "@josxa/kit-utils"
import type { RefreshableControls } from "@josxa/kit-utils"

import { activeScreen } from "../../store"

export abstract class KitGptScreen<T> {
  protected abstract name: string

  protected abstract render(controls: RefreshableControls<T>): Promise<T | typeof FORCE_REFRESH>

  /**
   * Wraps around the given render function to update the state which screen is currently active
   * (so that setActions calls don't interfere).
   */
  public async run(): Promise<T> {
    const result = await refreshable<T>((controls) => {
      activeScreen.value = this.name
      return this.render(controls)
    })

    activeScreen.value = undefined
    console.log("switched screen")
    return result
  }
}

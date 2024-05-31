import type { CoreTool } from "ai"
import type { z } from "zod"

export type ChatControls = {
  append: (text: string) => void
  appendLine: (text: string) => void
  send: (text: string) => void
}

export type KitGptTool<TParams extends z.ZodTypeAny = any> = Omit<CoreTool<TParams, void>, "execute"> & {
  displayText?: string
  execute: (chat: ChatControls, args: z.infer<TParams>) => PromiseLike<unknown>
}

export function kitGptTool<TParams extends z.ZodTypeAny>(
  tool: Omit<CoreTool<TParams, void>, "execute"> & {
    displayText?: string
    execute: (chat: ChatControls, args: z.infer<TParams>) => PromiseLike<unknown>
  },
): Omit<CoreTool<TParams, void>, "execute"> & {
  displayText?: string
  execute: (chat: ChatControls, args: z.infer<TParams>) => PromiseLike<unknown>
} {
  return tool
}

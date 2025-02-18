// noinspection ExceptionCaughtLocallyJS

import "@johnlindquist/kit"
import { type RefreshableControls, showError } from "@josxa/kit-utils"
import { effect, signal } from "@preact/signals-core"

import { writeFile } from "node:fs/promises"
import type { CoreMessage } from "ai"
import { deepSignal } from "deepsignal/core"
import { currentUnsentDraft } from "../../store/conversations"
import { messages, subscribeToMessageEdits } from "../../store/messages"
import { lastGeneratedScriptContent } from "../../store/script-generator"
import SubmitLinkEncoder from "../../utils/SubmitLinkEncoder"
import { titleCase } from "../../utils/string-utils"
import AbstractChatScreen from "./AbstractChatScreen"

export enum TOOL_RESULT_ACTION {
  SaveGeneratedScript = "save-generated-script",
  OpenGeneratedScriptInEditor = "open-in-editor",
  RunGeneratedScript = "run-script",
}

function buildKitMessage(coreMessage: CoreMessage) {
  const mdText = Array.isArray(coreMessage.content) ? coreMessage.content.join("") : coreMessage.content

  return {
    title: coreMessage.role === "user" ? "You" : titleCase(coreMessage.role),
    text: md(mdText),
    position: coreMessage.role === "user" ? "right" : "left",
  }
}

type Message = Awaited<ReturnType<typeof chat>>[number]

export default class ChatScreen extends AbstractChatScreen<Message[]> {
  name = "chat"

  override *initEffects() {
    const kitUpdateQueue = deepSignal<Array<() => Promise<unknown> | unknown>>([])
    yield effect(() => kitUpdateQueue.length > 0 && fireUpdates())

    let isRunning = false
    const fireUpdates = async () => {
      if (isRunning) {
        return
      }
      isRunning = true

      try {
        while (kitUpdateQueue.length > 0) {
          await kitUpdateQueue.shift()?.()
        }
      } finally {
        isRunning = false
      }
    }

    const prevLength = signal(0)
    yield messages.$length!.subscribe(function onNewMessages(newLength: number) {
      if (newLength === 0) {
        kitUpdateQueue.push(() => chat.setMessages?.([]))
      } else if (newLength > prevLength.value) {
        const newMessages = messages.slice(prevLength.value, newLength)

        newMessages.forEach((msg, idx) => {
          const msgIdx = prevLength.value + idx
          const kitMsg = buildKitMessage(msg)
          kitUpdateQueue.push(() => chat.setMessage?.(msgIdx, kitMsg))
        })
      }

      prevLength.value = newLength
    })

    yield subscribeToMessageEdits((msgSignal, idx) => chat.setMessage?.(idx, buildKitMessage(msgSignal)))
  }

  async render(refreshableControls: RefreshableControls<Message[]>) {
    const { refresh } = refreshableControls

    const config = this.buildPromptConfig(refreshableControls, { afterInit: () => setInput(currentUnsentDraft.value) })
    const result = (await chat({
      ...config,
      input: currentUnsentDraft.value,
      onSubmit(content) {
        content && messages.push({ role: "user", content })
      },
      onInput(draftText) {
        currentUnsentDraft.value = draftText ?? ""
      },
    })) as Message[] | TOOL_RESULT_ACTION

    if (isToolResultAction(result)) {
      const decoder = SubmitLinkEncoder.decode(result)

      const writeLastGeneratedScript = async (filePath: string) => {
        if (!lastGeneratedScriptContent.value) {
          throw new Error("No script contents found!")
        }
        await writeFile(filePath, lastGeneratedScriptContent.value, "utf-8")
      }

      // noinspection FallThroughInSwitchStatementJS
      switch (decoder.action) {
        case TOOL_RESULT_ACTION.SaveGeneratedScript: {
          const filePath = decoder.params.file!
          try {
            await writeLastGeneratedScript(filePath)
          } catch (err) {
            await showError(err)
          }
          return refresh()
        }
        case TOOL_RESULT_ACTION.OpenGeneratedScriptInEditor: {
          try {
            const filePath = decoder.params.file!
            await writeLastGeneratedScript(filePath)
            await edit(filePath)
          } catch (err) {
            await showError(err)
          }

          return refresh()
        }
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: exit is never
        case TOOL_RESULT_ACTION.RunGeneratedScript: {
          try {
            const filePath = decoder.params.file!
            await writeLastGeneratedScript(filePath)
            await run(decoder.params.scriptName!)
          } catch (err) {
            await showError(err)
            return refresh()
          }

          exit() // Can't refresh after running a script anyway
        }
        default:
          return refresh()
      }
    }

    return result
  }
}

function isToolResultAction(result: Message[] | TOOL_RESULT_ACTION): result is TOOL_RESULT_ACTION {
  return typeof result === "string" && SubmitLinkEncoder.canDecode(result)
}

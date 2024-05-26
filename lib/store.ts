import "@johnlindquist/kit"

import type { openai } from "@ai-sdk/openai"
import { effect, signal } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import Database from "better-sqlite3"
import { deepSignal } from "deepsignal/core"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { type Provider, getModel } from "./models"

import fs from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { type InsertConversation, conversations } from "./schema"
import type { FollowupQuestions } from "./suggestions"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)

type DbData = {
  modelId?: Parameters<typeof openai>[0]
  provider?: Provider
  systemPrompt: string // TODO: Extend to support a collection
}
const settingsDb = await db("_kitgpt-chat.settings", {
  systemPrompt: "You are a helpful, respectful and honest assistant.",
} as DbData)

export const model = signal(
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined,
)
export const systemPrompt = signal(settingsDb.systemPrompt)

const debouncedWriteCache = debounce(settingsDb.write, 1000, {
  leading: false,
  trailing: true,
})

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.modelId = model.value?.modelId
  settingsDb.provider = model.value?.provider as Provider

  debouncedWriteCache()
})

export const messages = deepSignal<CoreMessage[]>([])

export const subscribeToMessageEdits = (
  handler: ((msgSignal: (typeof messages)[number], idx: number) => unknown) | (() => void),
) =>
  effect(() => {
    const cleanupFns = messages.map((msgSignal, idx) => {
      let firstRun = true
      return msgSignal.$content!.subscribe(() => {
        if (firstRun) {
          firstRun = false
          return
        }
        handler(msgSignal, idx)
      })
    })

    return () => cleanupFns.forEach((sub) => sub())
  })

debugger

const dbFilePath = path.join(__dirname, "../db", "_kitgpt-chat.history.sqlite3")
const sqlite = new Database(dbFilePath)
const drizzleDb = drizzle(sqlite)

async function testConnection() {
  try {
    await drizzleDb.select().from(conversations).limit(1)
    return true
  } catch (err) {
    return false
  }
}

async function ensureDbInitialized() {
  if (!(await testConnection())) {
    try {
      migrate(drizzleDb, { migrationsFolder: path.join(__dirname, "../drizzle") })
      await testConnection()
    } catch (err) {
      const backupPath = dbFilePath.replace(".sqlite3", ".corrupted.sqlite3")
      await div(
        md(`## Database corrupted
      
The conversations database appears to be corrupted. Creating a backup at <code>${backupPath}</code> and attempting to recreate the database.`),
      )

      await fs.copyFile(dbFilePath, backupPath)
      await fs.rm(dbFilePath)
      migrate(drizzleDb, { migrationsFolder: path.join(__dirname, "../drizzle") })
    }
  }
}

await ensureDbInitialized()

const debouncedUpdateConversation = debounce(
  (conversation: InsertConversation) => drizzleDb.update(conversations).set(conversation),
  300,
  {
    leading: false,
    trailing: true,
  },
)
const insertConversation = (conversation: InsertConversation) => drizzleDb.insert(conversations).values(conversation)

export async function getConversations() {
  return await drizzleDb.select().from(conversations).limit(100)
}

const currentConversationId = signal<number | bigint | undefined>(undefined)
export const currentConversationTitle = signal<string>("Untitled")

effect(async () => {
  messages.forEach((x) => x.content) // dep

  if (currentConversationId.value) {
    debouncedUpdateConversation({
      title: currentConversationTitle.value,
      messages,
    })
  } else {
    if (messages.length === 0) {
      return
    }

    const res = await insertConversation({
      title: currentConversationTitle.value,
      messages: messages,
    })
    currentConversationId.value = res.lastInsertRowid
  }
})

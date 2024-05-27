import "@johnlindquist/kit"

import type { openai } from "@ai-sdk/openai"
import { batch, effect, signal } from "@preact/signals-core"
import type { CoreMessage } from "ai"
import Database from "better-sqlite3"
import { deepSignal } from "deepsignal/core"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { type Provider, getModel } from "./models"

import fs from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { desc, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import type { FollowupQuestions } from "./ai/suggestions"
import { type Conversation, type InsertConversation, conversations } from "./schema"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)

type DbData = {
  modelId?: Parameters<typeof openai>[0]
  provider?: Provider
  systemPrompt: string // TODO: Extend to support a collection
  welcomeShown: boolean
}
const settingsDb = await db("_kitgpt-chat.settings", {
  systemPrompt: "You are a helpful, respectful and honest assistant.",
  welcomeShown: false,
} as DbData)

export const currentModel = signal(
  settingsDb.provider && settingsDb.modelId ? await getModel(settingsDb.provider, settingsDb.modelId) : undefined,
)
export const systemPrompt = signal(settingsDb.systemPrompt)
export const welcomeShown = signal(settingsDb.welcomeShown)

const debouncedWriteCache = debounce(settingsDb.write, 1000, {
  leading: false,
  trailing: true,
})

effect(() => {
  settingsDb.systemPrompt = systemPrompt.value
  settingsDb.welcomeShown = welcomeShown.value
  settingsDb.modelId = currentModel.value?.modelId
  settingsDb.provider = currentModel.value?.provider as Provider

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

export const updateConversation = (id: number, values: Omit<InsertConversation, "id">) =>
  drizzleDb.update(conversations).set(values).where(eq(conversations.id, id)).execute()

const debouncedUpdateConversation = debounce(updateConversation, 300, {
  leading: false,
  trailing: true,
})

const CONVERSATION_METADATA_FIELDS = {
  id: conversations.id,
  title: conversations.title,
  started: conversations.started,
} as const satisfies Partial<{ [Key in keyof Conversation]: (typeof conversations)[Key] }>

const insertConversation = (conversation: InsertConversation) =>
  drizzleDb.insert(conversations).values(conversation).returning(CONVERSATION_METADATA_FIELDS)

export const deleteConversation = (id: number) =>
  drizzleDb.delete(conversations).where(eq(conversations.id, id)).execute()

export async function getFullConversation(id: number) {
  const res = await drizzleDb.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!res[0]) {
    throw Error(`Conversation with id ${id} does not exist.`)
  }
  return res[0]
}

export async function getAllConversationMetadata() {
  return await drizzleDb
    .select(CONVERSATION_METADATA_FIELDS)
    .from(conversations)
    .orderBy(desc(conversations.id))
    .limit(100)
    .execute()
}

export const currentConversationId = signal<number | undefined>(undefined)
export const currentConversationTitle = signal<string | undefined>(undefined)

const isInserting = signal(false)
effect(() => {
  messages.forEach((x) => x.content) // dep

  if (currentConversationId.value) {
    debouncedUpdateConversation(currentConversationId.value, {
      title: currentConversationTitle.value ?? "Untitled",
      messages,
    })
  } else {
    if (messages.length === 0 || isInserting.value) {
      return
    }

    isInserting.value = true

    insertConversation({
      title: currentConversationTitle.value,
      messages: messages,
    })
      .then((res) => {
        const metadataOfInserted = res[0]!
        currentConversationId.value = metadataOfInserted.id
      })
      .finally(() => {
        isInserting.value = false
      })
  }
})

export function resetConversation() {
  batch(() => {
    currentConversationId.value = undefined
    currentConversationTitle.value = undefined
    currentSuggestions.value = undefined
    messages.splice(0, messages.length)
  })
}

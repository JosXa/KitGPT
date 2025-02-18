import { desc, eq } from "drizzle-orm"
import { kitGptDb } from "./db"
import { type Conversation, type InsertConversation, conversations } from "./schema"

export const updateConversation = (id: number, values: Omit<InsertConversation, "id">) =>
  kitGptDb.update(conversations).set(values).where(eq(conversations.id, id)).execute()

export const debouncedUpdateConversation = debounce(updateConversation, 300, {
  leading: false,
  trailing: true,
})

const CONVERSATION_METADATA_FIELDS = {
  id: conversations.id,
  title: conversations.title,
  started: conversations.started,
} as const satisfies Partial<{ [Key in keyof Conversation]: (typeof conversations)[Key] }>

export const insertConversation = (conversation: InsertConversation) =>
  kitGptDb.insert(conversations).values(conversation).returning(CONVERSATION_METADATA_FIELDS)

export const deleteConversation = (id: number) =>
  kitGptDb.delete(conversations).where(eq(conversations.id, id)).execute()

export async function getFullConversation(id: number) {
  const res = await kitGptDb.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!res[0]) {
    throw new Error(`Conversation with id ${id} does not exist.`)
  }
  return res[0]
}

export async function getAllConversationMetadata() {
  return await kitGptDb
    .select(CONVERSATION_METADATA_FIELDS)
    .from(conversations)
    .orderBy(desc(conversations.id))
    .limit(100)
    .execute()
}

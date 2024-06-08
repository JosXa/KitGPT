import type { CoreMessage } from "ai"
import { sql } from "drizzle-orm"
import { customType, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

const customJsonb = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "jsonb"
    },
    fromDriver(value: string): TData {
      return JSON.parse(value)
    },
    toDriver(value: TData): string {
      return JSON.stringify(value)
    },
  })(name)

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("name"),
  messages: customJsonb<CoreMessage[]>("messages"),
  lastUnsentUserMessage: text("last_unsent_user_message"),
  started: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
  lastAccessed: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
})

export type Conversation = typeof conversations.$inferSelect
export type InsertConversation = typeof conversations.$inferInsert

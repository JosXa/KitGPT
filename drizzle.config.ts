import { defineConfig } from "drizzle-kit"

//@ts-expect-error
export default defineConfig({
  schema: "./lib/database/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "better-sqlite",
  dbCredentials: {
    url: "./db/_kitgpt-chat.history.sqlite3",
  },
})

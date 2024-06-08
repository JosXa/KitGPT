import fs from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { startSpinner } from "@josxa/kit-utils"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { conversations } from "./schema"

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbFilePath = path.join(__dirname, "../db", "_kitgpt-chat.history.sqlite3")
const sqlite = new Database(dbFilePath)
export const kitGptDb = drizzle(sqlite)

async function testConnection() {
  try {
    await kitGptDb.select().from(conversations).limit(1)
    return true
  } catch (err) {
    return false
  }
}

const migrateDb = () => {
  const spinner = startSpinner("circle", { initialMessage: "Migrating database..." })
  migrate(kitGptDb, { migrationsFolder: path.join(__dirname, "../drizzle") })
  spinner.stop()
}

export async function ensureDbInitialized(onCorrupted: (info: { backupPath: string }) => Promise<void>) {
  if (!(await testConnection())) {
    try {
      migrateDb()
      await testConnection()
    } catch (err) {
      const backupPath = dbFilePath.replace(".sqlite3", ".corrupted.sqlite3")
      await onCorrupted({ backupPath })
      await fs.copyFile(dbFilePath, backupPath)
      await fs.rm(dbFilePath)
      migrateDb()
    }
  }
}

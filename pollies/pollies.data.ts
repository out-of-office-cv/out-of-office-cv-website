import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "..")

function parseCSV(content: string): string[][] {
  const lines = content.trim().split("\n")
  return lines.map((line) => {
    const values: string[] = []
    let current = ""
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  })
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export interface PollieListItem {
  slug: string
  name: string
  division: string
  state: string
  party: string
}

declare const data: PollieListItem[]
export { data }

export default {
  watch: ["../data/representatives.csv"],
  load(): PollieListItem[] {
    const csvPath = resolve(rootDir, "data/representatives.csv")
    if (!existsSync(csvPath)) {
      return []
    }

    const content = readFileSync(csvPath, "utf-8")
    const rows = parseCSV(content)
    const [, ...dataRows] = rows

    return dataRows
      .filter((row) => row[2])
      .map((row) => ({
        slug: slugify(row[2]),
        name: row[2],
        division: row[3] || "",
        state: row[4] || "",
        party: row[9] || "",
      }))
  },
}

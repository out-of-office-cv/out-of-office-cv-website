import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Pollie {
  slug: string
  name: string
  division: string
  state: string
  party: string
  electedDate: string
  electionType: string
  ceasedDate: string
  reason: string
  stillInOffice: boolean
}

function parseCSV(content: string): string[][] {
  const lines = content.trim().split('\n')
  return lines.map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
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
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function loadPollies(): Pollie[] {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const csvPath = resolve(__dirname, 'representatives.csv')
  const content = readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)

  const [, ...dataRows] = rows

  return dataRows
    .filter(row => row[2])
    .map(row => ({
      slug: slugify(row[2]),
      name: row[2],
      division: row[3] || '',
      state: row[4] || '',
      party: row[9] || '',
      electedDate: row[5] || '',
      electionType: row[6] || '',
      ceasedDate: row[7] || '',
      reason: row[8] || '',
      stillInOffice: row[8] === 'still_in_office'
    }))
}

export default {
  load(): Pollie[] {
    return loadPollies()
  }
}

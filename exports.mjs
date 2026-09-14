// @ts-check
// Keeps finished conversions on disk so they survive the job cleanup and the
// server restarting. Everything lives under ~/.tapelay/exports, which is the
// honest place for a local-only tool: the files stay on the machine that made
// them and the user can delete the folder to be rid of them.

import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const ROOT = process.env.TAPELAY_HOME ?? path.join(homedir(), '.tapelay')
const DIR = path.join(ROOT, 'exports')
const INDEX = path.join(DIR, 'index.json')

// Enough to keep a working history without quietly eating the disk.
const MAX_ITEMS = 100

/** @returns {Promise<import('./protocol').ExportRecord[]>} */
async function readIndex() {
  try {
    const raw = JSON.parse(await readFile(INDEX, 'utf8'))
    return Array.isArray(raw?.items) ? raw.items : []
  } catch {
    return []
  }
}

/** @param {import('./protocol').ExportRecord[]} items */
async function writeIndex(items) {
  await mkdir(DIR, { recursive: true })
  await writeFile(INDEX, JSON.stringify({ version: 1, items }, null, 2))
}

/**
 * Newest first, with entries whose file went missing dropped rather than shown
 * as broken download links.
 * @returns {Promise<import('./protocol').ExportRecord[]>}
 */
export async function listExports() {
  const items = await readIndex()
  const alive = items.filter((item) => existsSync(path.join(DIR, item.id, item.filename)))
  if (alive.length !== items.length) await writeIndex(alive)
  return alive.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * @param {string} id
 * @returns {Promise<{ record: import('./protocol').ExportRecord, filePath: string } | null>}
 */
export async function getExport(id) {
  const record = (await readIndex()).find((item) => item.id === id)
  if (!record) return null
  const filePath = path.join(DIR, record.id, record.filename)
  return existsSync(filePath) ? { record, filePath } : null
}

/**
 * Copies a finished output into the store. The job directory is still cleaned
 * up on its own schedule, so this has to be a copy rather than a move.
 *
 * @param {{
 *   outPath: string,
 *   filename: string,
 *   meta: Omit<import('./protocol').ExportRecord, 'id' | 'filename' | 'createdAt' | 'size'>,
 * }} params
 * @returns {Promise<import('./protocol').ExportRecord>}
 */
export async function saveExport({ outPath, filename, meta }) {
  const id = randomUUID()
  const dir = path.join(DIR, id)
  await mkdir(dir, { recursive: true })
  await copyFile(outPath, path.join(dir, filename))
  const info = await stat(path.join(dir, filename))

  /** @type {import('./protocol').ExportRecord} */
  const record = { ...meta, id, filename, size: info.size, createdAt: new Date().toISOString() }

  const items = [record, ...(await readIndex())]
  const keep = items.slice(0, MAX_ITEMS)
  for (const dropped of items.slice(MAX_ITEMS)) {
    await rm(path.join(DIR, dropped.id), { recursive: true, force: true }).catch(() => {})
  }
  await writeIndex(keep)
  return record
}

/**
 * @param {string} id
 * @returns {Promise<boolean>} whether anything was removed
 */
export async function deleteExport(id) {
  const items = await readIndex()
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return false
  await rm(path.join(DIR, id), { recursive: true, force: true }).catch(() => {})
  await writeIndex(next)
  return true
}

/** Where the files live, for showing the user in the UI. */
export function exportsDir() {
  return DIR
}
